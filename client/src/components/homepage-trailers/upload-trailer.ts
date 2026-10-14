import { postData } from "@/lib/fetch-util";

/** Matches the backend's MAX_TRAILER_BYTES, which the S3 policy also enforces. */
export const TRAILER_MAX_BYTES = 200 * 1024 * 1024;
export const TRAILER_TYPE = "video/mp4";

type PresignResponse = {
  success: boolean;
  uploadUrl: string;
  fields?: Record<string, string>;
  key: string;
  publicUrl: string;
  message?: string;
};

export function validateTrailerFile(file: File): string | null {
  if (file.type !== TRAILER_TYPE) return "Trailers must be MP4 files (H.264 video).";
  if (file.size > TRAILER_MAX_BYTES) return "Video is larger than the 200MB limit.";
  if (file.size === 0) return "That file is empty.";
  return null;
}

/**
 * Presigns, then uploads with XMLHttpRequest rather than fetch: fetch cannot
 * report upload progress, and a 200MB file with no progress bar looks hung.
 * Fields go first and the file last — S3 ignores anything after `file`.
 * No Authorization header: S3 rejects the one fetch-util attaches.
 */
export async function uploadTrailer(
  file: File,
  title: string,
  onProgress: (fraction: number) => void,
): Promise<{ key: string; url: string }> {
  const presign = await postData<PresignResponse>("/uploads/presign/homepage-trailer", {
    title,
    contentType: file.type,
    contentLength: file.size,
  });
  if (!presign?.uploadUrl || !presign?.key || !presign?.publicUrl) {
    throw new Error(presign?.message || "Could not start upload");
  }

  const form = new FormData();
  for (const [name, value] of Object.entries(presign.fields ?? {})) form.append(name, String(value));
  form.append("file", file);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", presign.uploadUrl);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      reject(
        new Error(
          xhr.responseText.includes("EntityTooLarge")
            ? "Video is larger than the 200MB limit."
            : "Upload to storage failed",
        ),
      );
    };
    xhr.onerror = () => reject(new Error("Network error while uploading — check your connection and try again"));
    xhr.send(form);
  });

  return { key: presign.key, url: presign.publicUrl };
}
