import { Request, Response } from "express";
import {
  ALLOWED_UPLOAD_CONTENT_TYPE,
  createPresignedUpload,
  S3ConfigError,
} from "../libs/s3.js";

/**
 * Public API: Issues a presigned S3 upload URL for a single webp image.
 * The frontend PUTs the file directly to `uploadUrl` with a
 * `Content-Type: image/webp` header, then builds the public/CloudFront URL
 * from `key` once the upload succeeds.
 */
export const requestUploadUrl = async (req: Request, res: Response) => {
  try {
    const { contentType } = req.body as Record<string, unknown>;

    // Enforced server-side, not just via the <input accept> hint — the
    // presigned PUT itself is also locked to this content type, so a
    // mismatched upload will be rejected by S3.
    if (contentType !== ALLOWED_UPLOAD_CONTENT_TYPE) {
      return res.status(400).json({
        success: false,
        message: `Only ${ALLOWED_UPLOAD_CONTENT_TYPE} uploads are allowed`,
      });
    }

    const { uploadUrl, key } = await createPresignedUpload();
    res.status(200).json({ success: true, uploadUrl, key });
  } catch (error) {
    console.error(error);
    if (error instanceof S3ConfigError) {
      return res.status(500).json({ success: false, message: error.message });
    }
    // Anything else (bad AWS credentials, missing bucket permission, network
    // failure) — keep the public message generic and rely on server logs.
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
