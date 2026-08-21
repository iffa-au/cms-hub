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
): Promise<PresignedUpload> {
  const config = loadConfig();
  const prefix = folder === "partners" ? config.partnersPrefix : config.uploadPrefix;
  const extension = EXTENSION_BY_CONTENT_TYPE[contentType] ?? "webp";
  const key = `${prefix}/${randomUUID()}.${extension}`;

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
