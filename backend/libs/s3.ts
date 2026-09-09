import { randomUUID } from "crypto";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

const PRESIGN_EXPIRY_SECONDS = 300; // 5 minutes — plenty for a browser to start the PUT

type S3Config = {
  region: string;
  bucket: string;
  uploadPrefix: string;
  partnersPrefix: string;
  festivalsPrefix: string;
};

/**
 * Partner logos and festival assets live beside the submissions folder rather
 * than inside it. Derived from the submissions prefix by default (so
 * "iffa/images/submissions-2026" implies "iffa/images/partners" and
 * "iffa/images/festivals"), keeping the bucket layout consistent without extra
 * env vars that have to be remembered on every deploy target. Override with
 * AWS_S3_PARTNERS_PREFIX / AWS_S3_FESTIVALS_PREFIX if they ever need to live
 * somewhere unrelated.
 */
function deriveSiblingPrefix(uploadPrefix: string, folder: string): string {
  const lastSlash = uploadPrefix.lastIndexOf("/");
  const parent = lastSlash === -1 ? "" : uploadPrefix.slice(0, lastSlash);
  return parent ? `${parent}/${folder}` : folder;
}

let cachedConfig: S3Config | null = null;
let cachedClient: S3Client | null = null;

// Distinguished from AWS SDK errors (bad credentials, no bucket permission,
// etc.) so the controller can tell a missing-config deploy from a genuine
// AWS-side failure without parsing SDK error internals.
export class S3ConfigError extends Error {}

/**
 * Turns an AWS SDK failure into something the admin staring at the CMS can act
 * on, or null if it is not a recognised infrastructure problem.
 *
 * `S3ConfigError` above covers the case where an env var is missing outright.
 * This covers the two ways S3 still fails once the config is complete: a server
 * with no credentials at all (a developer laptop) and a server whose IAM role
 * lacks a permission (the deployed instance role). Both surfaced as a bare
 * "Internal server error", which is indistinguishable from a real bug and sent
 * us looking in the wrong place — the upload code was fine in both cases.
 *
 * Returns null for anything unrecognised on purpose: a genuine bug must not be
 * dressed up as an infrastructure problem, which would be the same mistake in
 * the other direction.
 */
export function describeS3Failure(error: unknown): string | null {
  const name = (error as { name?: string } | null)?.name ?? "";
  const status = (error as { $metadata?: { httpStatusCode?: number } } | null)
    ?.$metadata?.httpStatusCode;

  if (name === "CredentialsProviderError") {
    return (
      "This server has no AWS credentials, so it cannot issue image uploads. " +
      "Locally: add AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to the backend's .env. " +
      "Deployed: attach the instance role. Everything except images saves without them."
    );
  }

  if (name === "AccessDenied" || name === "AccessDeniedException" || status === 403) {
    return (
      "AWS refused this request. The server's IAM role is missing an S3 permission " +
      "on the media bucket: s3:PutObject to upload, s3:DeleteObject and s3:ListBucket " +
      "to remove a festival's assets."
    );
  }

  if (name === "NoSuchBucket") {
    return "The configured S3 bucket does not exist — check AWS_S3_BUCKET on this server.";
  }

  return null;
}

function loadConfig(): S3Config {
  if (cachedConfig) return cachedConfig;
  const {
    AWS_REGION,
    AWS_S3_BUCKET,
    AWS_S3_UPLOAD_PREFIX,
    AWS_S3_PARTNERS_PREFIX,
    AWS_S3_FESTIVALS_PREFIX,
  } = process.env;

  if (!AWS_REGION || !AWS_S3_BUCKET) {
    const missing = [
      !AWS_REGION && "AWS_REGION",
      !AWS_S3_BUCKET && "AWS_S3_BUCKET",
    ].filter(Boolean).join(", ");
    throw new S3ConfigError(
      `Missing AWS env vars on this server: ${missing}. Set them in the deploy target's environment config (not just a local .env file).`,
    );
  }

  const trim = (value: string) => value.replace(/^\/+|\/+$/g, "");
  // Kept as its own env var (rather than hardcoded) so the target folder
  // can move later without a code change — e.g. once this season's
  // submissions should start landing under a new prefix.
  const uploadPrefix = trim(AWS_S3_UPLOAD_PREFIX || "submissions-2026");

  cachedConfig = {
    region: AWS_REGION,
    bucket: AWS_S3_BUCKET,
    uploadPrefix,
    partnersPrefix: AWS_S3_PARTNERS_PREFIX
      ? trim(AWS_S3_PARTNERS_PREFIX)
      : deriveSiblingPrefix(uploadPrefix, "partners"),
    festivalsPrefix: AWS_S3_FESTIVALS_PREFIX
      ? trim(AWS_S3_FESTIVALS_PREFIX)
      : deriveSiblingPrefix(uploadPrefix, "festivals"),
  };
  return cachedConfig;
}

function getClient(): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({ region: loadConfig().region });
  }
  return cachedClient;
}

export const ALLOWED_UPLOAD_CONTENT_TYPE = "image/webp";

/**
 * 5MB — mirrors MAX_UPLOAD_MB in the public site's WebpImageUpload.
 *
 * Enforced by S3 itself via the content-length-range condition in the
 * presigned POST policy issued by createSubmissionAssetUpload, so an
 * oversized upload is rejected at the edge with EntityTooLarge and never
 * reaches the bucket. The browser-side check in WebpImageUpload is only there
 * to give a friendly message first.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Rejects a zero-byte upload as well as an oversized one. */
const MIN_UPLOAD_BYTES = 1;

export type UploadFolder = "submissions" | "partners" | "festivals";

/**
 * Per-folder allowlists. The public submit-film form stays webp-only (that
 * constraint is enforced in its UI and worth keeping), while partner logos
 * also accept PNG — logos need transparency and the existing set is PNG.
 * Festival artwork is photographic (hero banners, film posters) and comes from
 * whatever a distributor supplied, so it accepts the same set as partners.
 */
const ALLOWED_CONTENT_TYPES: Record<UploadFolder, readonly string[]> = {
  submissions: ["image/webp"],
  partners: ["image/webp", "image/png", "image/jpeg"],
  festivals: ["image/webp", "image/png", "image/jpeg"],
};

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
};

export function allowedContentTypesFor(folder: UploadFolder): readonly string[] {
  return ALLOWED_CONTENT_TYPES[folder];
}

/**
 * Turns arbitrary user text into a safe key fragment.
 *
 * Drops every character that isn't a word char, space or dash, and collapses
 * the rest into a lowercase slug. Because "/", "\" and "." are all removed,
 * the result can never escape the intended prefix — path traversal is
 * structurally impossible rather than blacklisted.
 *
 * A title with no Latin characters at all slugifies to nothing, hence the
 * fallback: the key still has to be a valid, non-empty path segment.
 */
function slugify(value: string, fallback = "file"): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60);
  return slug || fallback;
}

/**
 * Same, for a filename — the extension is stripped first because the real one
 * is derived from the validated content type instead.
 */
function slugifyFileName(name: string): string {
  return slugify(name.replace(/\.[^.]+$/, ""));
}

export type PresignedUpload = {
  uploadUrl: string;
  /**
   * Policy fields that must be sent as form fields *before* the file.
   *
   * Only set by the presigned-POST helpers — currently just the public
   * submission upload, which needs a policy to carry its size limit. The
   * staff-only helpers (partner logos, festival artwork) issue presigned PUTs
   * and leave this undefined; their callers upload the bare file body.
   */
  fields?: Record<string, string>;
  key: string;
};

/**
 * Best-effort delete of a previously uploaded object.
 *
 * Never throws: cleanup is always secondary to the database write that
 * triggered it. If the IAM role lacks s3:DeleteObject, or the object is
 * already gone, the partner update/delete must still succeed — the worst
 * case is an orphaned file, which is strictly better than a failed edit.
 * Returns whether the delete actually went through, for logging.
 */
export async function deleteUploadedObject(key: string): Promise<boolean> {
  if (!key || !key.trim()) return false;
  try {
    const { bucket } = loadConfig();
    await getClient().send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key }),
    );
    return true;
  } catch (error) {
    console.error(`Failed to delete S3 object "${key}":`, error);
    return false;
  }
}

/**
 * Turns an uploaded object key into its public CloudFront URL.
 *
 * Throws rather than falling back to a raw S3 URL: a wrong-but-plausible URL
 * would be silently written into a partner record and only surface later as a
 * broken logo on the live site, which is far harder to trace than an upload
 * that refuses to start with a message naming the missing variable.
 */
export function buildPublicUrl(key: string): string {
  const base = process.env.CLOUDFRONT_URL;
  if (!base) {
    throw new S3ConfigError(
      "Missing CLOUDFRONT_URL env var on this server — required to build the public URL for uploaded images. Set it in the deploy target's environment config.",
    );
  }
  return `${base.replace(/\/+$/, "")}/${key}`;
}

/**
 * Issues a presigned PUT URL scoped to a single, server-generated key so the
 * browser can upload the file bytes straight to S3. The key is never derived
 * from client-supplied input (filename, etc.) to avoid path traversal or
 * collisions — only the extension varies, and only across a fixed map of
 * content types the caller's folder allows.
 *
 * Staff-only paths (partner logos) reach S3 through here. The public
 * submission path deliberately does not: it needs a size limit S3 itself
 * enforces, which a presigned PUT cannot express — see
 * createSubmissionAssetUpload.
 */
export async function createPresignedUpload(
  folder: UploadFolder = "submissions",
  contentType: string = ALLOWED_UPLOAD_CONTENT_TYPE,
  originalName?: string,
): Promise<PresignedUpload> {
  const config = loadConfig();
  const PREFIX_BY_FOLDER: Record<UploadFolder, string> = {
    submissions: config.uploadPrefix,
    partners: config.partnersPrefix,
    festivals: config.festivalsPrefix,
  };
  const prefix = PREFIX_BY_FOLDER[folder];
  const extension = EXTENSION_BY_CONTENT_TYPE[contentType] ?? "webp";

  // Readable name + short random suffix. The suffix is not decoration: two
  // people uploading "logo.png" must not overwrite each other, and reusing a
  // key would leave CloudFront serving the previous image from cache until
  // its TTL expires.
  const suffix = randomUUID().slice(0, 8);
  const base = originalName?.trim()
    ? `${slugifyFileName(originalName)}-${suffix}`
    : randomUUID();
  const key = `${prefix}/${base}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(getClient(), command, {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  });

  return { uploadUrl, key };
}

/**
 * Every file belonging to one submission lands under a single folder, split
 * into banners (portrait/landscape) and crews (one photo per crew member).
 * Keeping them together makes a submission's assets deletable as one prefix
 * and readable in the console, instead of ~10 anonymous objects scattered
 * through a flat per-season folder.
 */
export const SUBMISSION_ASSET_GROUPS = ["banners", "crews"] as const;
export type SubmissionAssetGroup = (typeof SUBMISSION_ASSET_GROUPS)[number];

/**
 * The folder-level uniqueness token, generated by the browser when the submit
 * form is opened and sent with every upload for that submission.
 *
 * It exists because film titles are neither unique nor stable: two "Dust"
 * submissions would otherwise write over each other's posters silently, since
 * S3 PUT overwrites without error. Paying for uniqueness once on the folder
 * leaves the files inside free to have clean, predictable names.
 */
export const SUBMISSION_REF_PATTERN = /^[a-f0-9]{8}$/;

export function isValidSubmissionRef(ref: unknown): ref is string {
  return typeof ref === "string" && SUBMISSION_REF_PATTERN.test(ref);
}

/**
 * Recomputed rather than accepted from the client, on both the presign call
 * and the later submission write. A client-supplied prefix would be a path
 * a future "delete this submission's assets" routine walks — pointing it at
 * "iffa/images/" would take the whole season with it.
 *
 * The slug is a snapshot of the title at submission time. S3 has no rename,
 * so correcting a title later will not move the folder: treat this as a human
 * hint for browsing, never as something to look a submission up by.
 */
export function buildSubmissionAssetPrefix(ref: string, title: string): string {
  if (!isValidSubmissionRef(ref)) {
    throw new Error(`Invalid submission asset ref: ${String(ref)}`);
  }
  return `${loadConfig().uploadPrefix}/${slugify(title, "untitled")}-${ref}`;
}

export type SubmissionAssetTarget = {
  ref: string;
  title: string;
  group: SubmissionAssetGroup;
  /** "portrait", "landscape", or a crew credit like "director-sam-raimi-1". */
  name: string;
};

/**
 * Presigned POST for one file inside a submission's folder.
 *
 * Kept separate from createPresignedUpload (which still serves partner logos)
 * so the two naming schemes can't drift into one another's parameters.
 *
 * POST rather than PUT specifically so the policy can carry
 * `content-length-range`: a presigned PUT URL has no way to express a size
 * limit, which left the 5MB cap enforceable only in the browser and trivially
 * bypassed by posting straight at the signed URL. This is the anonymous,
 * public submit-film path — the one place where that matters — so it is the
 * one helper that pays for a policy. The staff-only helpers stay on PUT.
 *
 * Re-uploading the same slot overwrites deliberately: a retried submit should
 * replace the half-uploaded file rather than leave an orphan beside it.
 */
export async function createSubmissionAssetUpload(
  target: SubmissionAssetTarget,
  contentType: string = ALLOWED_UPLOAD_CONTENT_TYPE,
): Promise<PresignedUpload> {
  const config = loadConfig();
  const extension = EXTENSION_BY_CONTENT_TYPE[contentType] ?? "webp";
  const prefix = buildSubmissionAssetPrefix(target.ref, target.title);
  const key = `${prefix}/${target.group}/${slugify(target.name)}.${extension}`;

  const { url, fields } = await createPresignedPost(getClient(), {
    Bucket: config.bucket,
    Key: key,
    Expires: PRESIGN_EXPIRY_SECONDS,
    // Conditions are what S3 actually checks on upload. Fields set defaults;
    // conditions constrain them, including against a tampered client.
    Conditions: [
      ["content-length-range", MIN_UPLOAD_BYTES, MAX_UPLOAD_BYTES],
      ["eq", "$Content-Type", contentType],
    ],
    Fields: {
      "Content-Type": contentType,
    },
  });

  return { uploadUrl: url, fields, key };
}

/* -------------------------------------------------------------------------
 * Festivals
 *
 * Same folder-per-record shape as submissions, for the same reason: festival
 * names are neither unique nor stable, and S3 PUT overwrites without error.
 *
 *   iffa/images/festivals/<festival-slug>-<8hex>/
 *     hero.webp
 *     screenings/the-arab.webp
 *
 * Unlike submissions, a festival's whole folder is deleted when the festival
 * is — see deleteUploadedPrefix below.
 * ---------------------------------------------------------------------- */

export const FESTIVAL_ASSET_GROUPS = ["hero", "screenings"] as const;
export type FestivalAssetGroup = (typeof FESTIVAL_ASSET_GROUPS)[number];

/** Reserved folder name for page-wide images; never a festival's own folder. */
export const FESTIVAL_PAGE_FOLDER = "page";

/** Same 8-hex shape as SUBMISSION_REF_PATTERN, generated by the CMS. */
export const FESTIVAL_REF_PATTERN = /^[a-f0-9]{8}$/;

export function isValidFestivalRef(ref: unknown): ref is string {
  return typeof ref === "string" && FESTIVAL_REF_PATTERN.test(ref);
}

/**
 * Computed server-side and stored on the festival at creation, then never
 * recomputed.
 *
 * Deliberately different from `buildSubmissionAssetPrefix`, which is recomputed
 * from the current title on every write. S3 has no rename: if a festival is
 * renamed after its artwork is uploaded, recomputing would produce a prefix the
 * files are *not* under, and the cascade delete would then walk an empty folder
 * and orphan every real asset. The stored prefix keeps the name it was created
 * with — a browsing hint, never something to look a festival up by.
 */
export function buildFestivalAssetPrefix(ref: string, name: string): string {
  if (!isValidFestivalRef(ref)) {
    throw new Error(`Invalid festival asset ref: ${String(ref)}`);
  }
  return `${loadConfig().festivalsPrefix}/${slugify(name, "untitled")}-${ref}`;
}

export type FestivalAssetTarget = {
  /** The festival's stored assetPrefix. Never rebuilt from a client-sent name. */
  prefix: string;
  group: FestivalAssetGroup;
  /** "hero", or a film title for a screening poster. */
  name: string;
};

/**
 * Presigned PUT for one file inside a festival's folder.
 *
 * Re-uploading the same slot overwrites deliberately: replacing a poster should
 * replace the file, not leave the old one beside it. The caller passes the
 * festival's stored prefix so a rename can never split one festival's assets
 * across two folders.
 */
export async function createFestivalAssetUpload(
  target: FestivalAssetTarget,
  contentType: string,
): Promise<PresignedUpload> {
  const config = loadConfig();
  const extension = EXTENSION_BY_CONTENT_TYPE[contentType] ?? "webp";
  assertDeletableFestivalPrefix(target.prefix);

  const key =
    target.group === "hero"
      ? `${target.prefix}/hero.${extension}`
      : `${target.prefix}/screenings/${slugify(target.name)}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(getClient(), command, {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  });

  return { uploadUrl, key };
}

/**
 * Presigned PUT for a Festivals *page* image — the hero background, the award
 * trophy — as opposed to one festival's artwork.
 *
 * Lands in a reserved `page/` folder beside the per-festival folders. It is
 * deliberately outside any festival's prefix so a festival delete can never
 * take a page-wide image with it; these are replaced one key at a time by the
 * settings controller instead.
 */
export async function createFestivalPageUpload(
  name: string,
  contentType: string,
): Promise<PresignedUpload> {
  const config = loadConfig();
  const extension = EXTENSION_BY_CONTENT_TYPE[contentType] ?? "webp";

  // A short random suffix, so replacing an image is not a same-key overwrite
  // that CloudFront would keep serving from cache until its TTL expires.
  const suffix = randomUUID().slice(0, 8);
  const key = `${config.festivalsPrefix}/page/${slugify(name, "image")}-${suffix}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(getClient(), command, {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  });

  return { uploadUrl, key };
}

/**
 * Refuses any prefix that is not one festival's own folder.
 *
 * This is the guard that stands between a bug and the whole festivals folder.
 * A prefix-delete walks whatever string it is given, so an empty value, the
 * festivals root, or a parent directory must throw *before* anything is listed
 * — never be treated as "delete a bit more than intended".
 *
 * Exported so the delete path and the upload path enforce the same rule: a
 * prefix good enough to write into is a prefix specific enough to delete.
 */
export function assertDeletableFestivalPrefix(prefix: string): void {
  const { festivalsPrefix } = loadConfig();
  const root = `${festivalsPrefix}/`;
  const value = String(prefix || "").trim();

  if (!value.startsWith(root)) {
    throw new Error(
      `Refusing to use festival prefix "${value}": it is not under "${root}".`,
    );
  }

  // Must name a folder *inside* the root, not the root itself.
  const remainder = value.slice(root.length).replace(/\/+$/, "");
  if (!remainder || remainder.includes("/")) {
    throw new Error(
      `Refusing to use festival prefix "${value}": expected exactly one folder under "${root}".`,
    );
  }

  // `page/` holds Festivals-page images that belong to no festival. A festival
  // whose slug happened to be "page" must not be able to delete them.
  if (remainder === FESTIVAL_PAGE_FOLDER) {
    throw new Error(
      `Refusing to use festival prefix "${value}": "${FESTIVAL_PAGE_FOLDER}" is reserved for page-wide images.`,
    );
  }
}

const DELETE_BATCH_SIZE = 1000; // S3's per-request maximum for DeleteObjects.

/**
 * Deletes every object under one festival's folder.
 *
 * Best-effort in the same sense as deleteUploadedObject: the festival record is
 * already gone by the time this runs, and a failure here (no s3:ListBucket, no
 * s3:DeleteObject, network) must not resurface as a failed delete to the admin.
 * Orphaned objects are recoverable; a half-deleted festival is not.
 *
 * The guard above is the one thing that *does* throw — a malformed prefix is a
 * bug, not a runtime condition, and must never reach ListObjectsV2.
 *
 * Returns the number of objects deleted, for logging.
 */
export async function deleteUploadedPrefix(prefix: string): Promise<number> {
  assertDeletableFestivalPrefix(prefix);

  const { bucket } = loadConfig();
  const client = getClient();
  const listPrefix = prefix.replace(/\/+$/, "") + "/";
  let deleted = 0;

  try {
    let continuationToken: string | undefined;

    do {
      const listed = await client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: listPrefix,
          ContinuationToken: continuationToken,
          MaxKeys: DELETE_BATCH_SIZE,
        }),
      );

      const keys = (listed.Contents ?? [])
        .map((object) => object.Key)
        .filter((key): key is string => !!key);

      if (keys.length > 0) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
          }),
        );
        deleted += keys.length;
      }

      // IsTruncated rather than the token alone: a truncated page always
      // carries a token, and an untruncated one must end the loop even if S3
      // echoes something back.
      continuationToken = listed.IsTruncated
        ? listed.NextContinuationToken
        : undefined;
    } while (continuationToken);
  } catch (error) {
    console.error(`Failed to delete S3 prefix "${listPrefix}":`, error);
  }

  return deleted;
}
