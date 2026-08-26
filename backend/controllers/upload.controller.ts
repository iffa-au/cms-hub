import { Request, Response } from "express";
import {
  ALLOWED_UPLOAD_CONTENT_TYPE,
  allowedContentTypesFor,
  buildPublicUrl,
  createPresignedUpload,
  createSubmissionAssetUpload,
  isValidSubmissionRef,
  S3ConfigError,
  SUBMISSION_ASSET_GROUPS,
  type SubmissionAssetGroup,
} from "../libs/s3.js";

const isAssetGroup = (value: unknown): value is SubmissionAssetGroup =>
  typeof value === "string" &&
  (SUBMISSION_ASSET_GROUPS as readonly string[]).includes(value);

/**
 * Public API: Issues a presigned S3 upload URL for a single webp image.
 * The frontend PUTs the file directly to `uploadUrl` with a
 * `Content-Type: image/webp` header, then builds the public/CloudFront URL
 * from `key` once the upload succeeds.
 *
 * `submissionRef` + `title` + `group` + `name` place the file inside that
 * submission's own folder. They're required together: a half-specified
 * request is a frontend bug, and silently dropping such a file back into the
 * flat season folder would leave it unfindable once the rest of the
 * submission's assets are grouped.
 */
export const requestUploadUrl = async (req: Request, res: Response) => {
  try {
    const { contentType, submissionRef, title, group, name } =
      req.body as Record<string, unknown>;

    // Enforced server-side, not just via the <input accept> hint — the
    // presigned PUT itself is also locked to this content type, so a
    // mismatched upload will be rejected by S3.
    if (contentType !== ALLOWED_UPLOAD_CONTENT_TYPE) {
      return res.status(400).json({
        success: false,
        message: `Only ${ALLOWED_UPLOAD_CONTENT_TYPE} uploads are allowed`,
      });
    }

    if (!isValidSubmissionRef(submissionRef)) {
      return res.status(400).json({
        success: false,
        message: "A valid submissionRef (8 hex characters) is required",
      });
    }

    if (!isAssetGroup(group)) {
      return res.status(400).json({
        success: false,
        message: `group must be one of: ${SUBMISSION_ASSET_GROUPS.join(", ")}`,
      });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "An asset name is required" });
    }

    const { uploadUrl, key } = await createSubmissionAssetUpload({
      ref: submissionRef,
      title: typeof title === "string" ? title : "",
      group,
      name,
    });
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

/**
 * Staff-only: presigned upload for a partner logo. Kept separate from the
 * public endpoint above so the anonymous submit-film flow can never be used
 * to write into the partners folder, and so logos can allow PNG (for
 * transparency) without loosening what the public form accepts.
 */
export const requestPartnerUploadUrl = async (req: Request, res: Response) => {
  try {
    const { contentType, fileName } = req.body as Record<string, unknown>;
    const allowed = allowedContentTypesFor("partners");

    if (typeof contentType !== "string" || !allowed.includes(contentType)) {
      return res.status(400).json({
        success: false,
        message: `Logo must be one of: ${allowed.join(", ")}`,
      });
    }

    const { uploadUrl, key } = await createPresignedUpload(
      "partners",
      contentType,
      typeof fileName === "string" ? fileName : undefined,
    );
    // publicUrl is resolved here rather than in the CMS so the admin client
    // doesn't need its own copy of the CloudFront domain as an env var.
    res.status(200).json({ success: true, uploadUrl, key, publicUrl: buildPublicUrl(key) });
  } catch (error) {
    console.error(error);
    if (error instanceof S3ConfigError) {
      return res.status(500).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
