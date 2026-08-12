import { randomUUID } from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024; // 15MB

export type PresignedUpload = {
  uploadUrl: string;
  key: string;
};

/**
 * Issues a presigned PUT URL scoped to a single, server-generated key so the
 * browser can upload the file bytes straight to S3. The key is never derived
 * from client-supplied input (filename, etc.) to avoid path traversal or
 * collisions — only the fixed .webp extension is used, since content type is
 * already restricted to image/webp.
 */
export async function createPresignedUpload(): Promise<PresignedUpload> {
  const { bucket, uploadPrefix } = loadConfig();
  const key = `${uploadPrefix}/${randomUUID()}.webp`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: ALLOWED_UPLOAD_CONTENT_TYPE,
  });

  const uploadUrl = await getSignedUrl(getClient(), command, {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  });

  return { uploadUrl, key };
}
