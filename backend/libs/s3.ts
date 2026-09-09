import { randomUUID } from "crypto";
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";

const PRESIGN_EXPIRY_SECONDS = 300; // 5 minutes — plenty for a browser to start the PUT

type S3Config = {
  region: string;
  bucket: string;
  uploadPrefix: string;
};

let cachedConfig: S3Config | null = null;
let cachedClient: S3Client | null = null;

// Distinguished from AWS SDK errors (bad credentials, no bucket permission,
// etc.) so the controller can tell a missing-config deploy from a genuine
// AWS-side failure without parsing SDK error internals.
export class S3ConfigError extends Error {}

function loadConfig(): S3Config {
  if (cachedConfig) return cachedConfig;
  const { AWS_REGION, AWS_S3_BUCKET, AWS_S3_UPLOAD_PREFIX } = process.env;

  if (!AWS_REGION || !AWS_S3_BUCKET) {
    const missing = [
      !AWS_REGION && "AWS_REGION",
      !AWS_S3_BUCKET && "AWS_S3_BUCKET",
    ].filter(Boolean).join(", ");
    throw new S3ConfigError(
      `Missing AWS env vars on this server: ${missing}. Set them in the deploy target's environment config (not just a local .env file).`,
    );
  }

  cachedConfig = {
    region: AWS_REGION,
    bucket: AWS_S3_BUCKET,
    // Kept as its own env var (rather than hardcoded) so the target folder
    // can move later without a code change — e.g. once this season's
    // submissions should start landing under a new prefix.
    uploadPrefix: (AWS_S3_UPLOAD_PREFIX || "submissions-2026").replace(
      /^\/+|\/+$/g,
      "",
    ),
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
 * presigned POST policy below, so an oversized upload is rejected at the
 * edge with EntityTooLarge and never reaches the bucket. The browser-side
 * check in WebpImageUpload is only there to give a friendly message first.
 */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Rejects a zero-byte upload as well as an oversized one. */
const MIN_UPLOAD_BYTES = 1;

export type PresignedUpload = {
  uploadUrl: string;
  /** Policy fields that must be sent as form fields *before* the file. */
  fields: Record<string, string>;
  key: string;
};

/**
 * Issues a presigned POST scoped to a single, server-generated key so the
 * browser can upload the file bytes straight to S3. The key is never derived
 * from client-supplied input (filename, etc.) to avoid path traversal or
 * collisions — only the fixed .webp extension is used, since content type is
 * already restricted to image/webp.
 *
 * POST rather than PUT specifically so the policy can carry
 * `content-length-range`: a presigned PUT URL has no way to express a size
 * limit, which left the 5MB cap enforceable only in the browser and
 * trivially bypassed by posting straight at the signed URL.
 */
export async function createPresignedUpload(): Promise<PresignedUpload> {
  const { bucket, uploadPrefix } = loadConfig();
  const key = `${uploadPrefix}/${randomUUID()}.webp`;

  const { url, fields } = await createPresignedPost(getClient(), {
    Bucket: bucket,
    Key: key,
    Expires: PRESIGN_EXPIRY_SECONDS,
    // Conditions are what S3 actually checks on upload. Fields set defaults;
    // conditions constrain them, including against a tampered client.
    Conditions: [
      ["content-length-range", MIN_UPLOAD_BYTES, MAX_UPLOAD_BYTES],
      ["eq", "$Content-Type", ALLOWED_UPLOAD_CONTENT_TYPE],
    ],
    Fields: {
      "Content-Type": ALLOWED_UPLOAD_CONTENT_TYPE,
    },
  });

  return { uploadUrl: url, fields, key };
}
