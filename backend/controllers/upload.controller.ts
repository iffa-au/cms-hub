import { Request, Response } from "express";
import {
  ALLOWED_UPLOAD_CONTENT_TYPE,
  createPresignedUpload,
  MAX_UPLOAD_BYTES,
  S3ConfigError,
} from "../libs/s3.js";

const MAX_UPLOAD_MB = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));

/**
 * Public API: Issues a presigned S3 POST for a single webp image. The
 * frontend posts `fields` plus the file as multipart/form-data to
 * `uploadUrl`, then builds the public/CloudFront URL from `key` once the
 * upload succeeds.
 */
export const requestUploadUrl = async (req: Request, res: Response) => {
  try {
    const { contentType, contentLength } = req.body as Record<string, unknown>;

    // Enforced server-side, not just via the <input accept> hint — the
    // presigned POST policy is also locked to this content type, so a
    // mismatched upload will be rejected by S3.
    if (contentType !== ALLOWED_UPLOAD_CONTENT_TYPE) {
      return res.status(400).json({
        success: false,
        message: `Only ${ALLOWED_UPLOAD_CONTENT_TYPE} uploads are allowed`,
      });
    }

    // Size is ultimately enforced by the content-length-range condition in
    // the policy, which S3 applies to the real body whatever a client claims
    // here. This check is the courteous half: when the client is honest we
    // refuse before issuing a URL, so the browser gets a readable JSON error
    // rather than an S3 EntityTooLarge XML document after a wasted upload.
    if (contentLength !== undefined) {
      const size = Number(contentLength);
      if (!Number.isFinite(size) || size <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid file size" });
      }
      if (size > MAX_UPLOAD_BYTES) {
        return res.status(413).json({
          success: false,
          message: `Image is too large. The limit is ${MAX_UPLOAD_MB}MB.`,
        });
      }
    }

    const { uploadUrl, fields, key } = await createPresignedUpload();
    res.status(200).json({ success: true, uploadUrl, fields, key });
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
