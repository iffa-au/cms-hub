import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const PRESIGN_EXPIRY_SECONDS = 300; // 5 minutes — plenty for a browser to start the PUT

type S3Config = {
  region: string;
  bucket: string;
  uploadPrefix: string;
  partnersPrefix: string;
};

/**
 * Partner logos live beside the submissions folder rather than inside it.
 * Derived from the submissions prefix by default (so
 * "iffa/images/submissions-2026" implies "iffa/images/partners"), keeping the
 * bucket layout consistent without a second env var that has to be remembered
 * on every deploy target. Override with AWS_S3_PARTNERS_PREFIX if the two ever
 * need to live somewhere unrelated.
 */
function derivePartnersPrefix(uploadPrefix: string): string {
  const lastSlash = uploadPrefix.lastIndexOf("/");
  const parent = lastSlash === -1 ? "" : uploadPrefix.slice(0, lastSlash);
  return parent ? `${parent}/partners` : "partners";
}

let cachedConfig: S3Config | null = null;
let cachedClient: S3Client | null = null;

// Distinguished from AWS SDK errors (bad credentials, no bucket permission,
// etc.) so the controller can tell a missing-config deploy from a genuine
// AWS-side failure without parsing SDK error internals.
export class S3ConfigError extends Error {}

function loadConfig(): S3Config {
  if (cachedConfig) return cachedConfig;
  const {
    AWS_REGION,
    AWS_S3_BUCKET,
    AWS_S3_UPLOAD_PREFIX,
    AWS_S3_PARTNERS_PREFIX,
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
      : derivePartnersPrefix(uploadPrefix),
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
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB

export type UploadFolder = "submissions" | "partners";

/**
 * Per-folder allowlists. The public submit-film form stays webp-only (that
 * constraint is enforced in its UI and worth keeping), while partner logos
 * also accept PNG — logos need transparency and the existing set is PNG.
 */
const ALLOWED_CONTENT_TYPES: Record<UploadFolder, readonly string[]> = {
  submissions: ["image/webp"],
  partners: ["image/webp", "image/png", "image/jpeg"],
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
 */
export async function createPresignedUpload(
  folder: UploadFolder = "submissions",
  contentType: string = ALLOWED_UPLOAD_CONTENT_TYPE,
  originalName?: string,
): Promise<PresignedUpload> {
  const config = loadConfig();
  const prefix = folder === "partners" ? config.partnersPrefix : config.uploadPrefix;
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
 * Presigned PUT for one file inside a submission's folder.
 *
 * Kept separate from createPresignedUpload (which still serves partner logos)
 * so the two naming schemes can't drift into one another's parameters.
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
