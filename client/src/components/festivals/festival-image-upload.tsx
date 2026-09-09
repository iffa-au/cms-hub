"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImageUp, X } from "lucide-react";
import { postData } from "@/lib/fetch-util";

/**
 * Festival hero images and screening posters.
 *
 * Same shape as `partners/partner-logo-upload.tsx`, including its central rule:
 * the file uploads when the form is SAVED, not when it is picked. An admin who
 * selects an image and then abandons the form must not leave an object behind
 * in the bucket.
 *
 * Unlike partner logos, the upload is addressed to a `festivalId` — the server
 * resolves the folder from the festival's stored `assetPrefix`, so the file
 * always lands where the cascade delete will look for it, even if the festival
 * is renamed afterwards.
 */

const ACCEPTED_TYPES = ["image/webp", "image/png", "image/jpeg"];
const MAX_BYTES = 15 * 1024 * 1024; // keep in sync with backend MAX_UPLOAD_BYTES

type PresignResponse = {
  success: boolean;
  uploadUrl: string;
  key: string;
  publicUrl: string;
  message?: string;
};

export type UploadedImage = { url: string; key: string };

export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Image must be a PNG, WEBP or JPEG.";
  }
  if (file.size > MAX_BYTES) return "Image is too large (max 15MB).";
  return null;
}

/**
 * Uploads one confirmed image and resolves to its public URL and object key.
 *
 * @param group "hero" for the festival banner, "screenings" for a film poster.
 * @param name  Film title for a screening poster; ignored for the hero.
 */
export async function uploadFestivalImage(
  file: File,
  festivalId: string,
  group: "hero" | "screenings",
  name = "hero",
): Promise<UploadedImage> {
  const presign = await postData<PresignResponse>("/uploads/presign/festival", {
    contentType: file.type,
    festivalId,
    group,
    name,
  });
  if (!presign?.uploadUrl || !presign?.publicUrl || !presign?.key) {
    throw new Error(presign?.message || "Could not start upload");
  }

  // Plain fetch, not the axios instance — the presigned URL carries its own
  // auth in the query string and S3 rejects the extra Authorization header
  // that fetch-util attaches to every request.
  const put = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!put.ok) throw new Error("Upload to storage failed");

  return { url: presign.publicUrl, key: presign.key };
}

/**
 * Uploads a Festivals *page* image — the hero background or the award trophy.
 *
 * Separate endpoint from the per-festival one because these belong to no
 * festival: they land in a reserved `page/` folder that a festival delete can
 * never reach.
 */
export async function uploadFestivalPageImage(
  file: File,
  name: string,
): Promise<UploadedImage> {
  const presign = await postData<PresignResponse>("/uploads/presign/festival-page", {
    contentType: file.type,
    name,
  });
  if (!presign?.uploadUrl || !presign?.publicUrl || !presign?.key) {
    throw new Error(presign?.message || "Could not start upload");
  }

  const put = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });
  if (!put.ok) throw new Error("Upload to storage failed");

  return { url: presign.publicUrl, key: presign.key };
}

type FestivalImageUploadProps = {
  /** Currently saved image URL, if any. */
  existingUrl: string;
  /** Newly picked file, not yet uploaded. */
  pendingFile: File | null;
  onSelect: (file: File | null) => void;
  onClearExisting: () => void;
  label?: string;
  /** Posters are portrait, hero banners are landscape. */
  shape?: "landscape" | "portrait";
};

export default function FestivalImageUpload({
  existingUrl,
  pendingFile,
  onSelect,
  onClearExisting,
  label = "Select image (PNG, WEBP or JPEG)",
  shape = "landscape",
}: FestivalImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  // Local preview for the pending file — no network involved.
  //
  // Derived during render rather than pushed into state from an effect: the
  // preview is a pure function of the picked file, and routing it through
  // setState in an effect costs an extra render and trips
  // `react-hooks/set-state-in-effect`. The effect below exists only to release
  // the blob when the file changes or the component unmounts.
  const previewUrl = useMemo(
    () => (pendingFile ? URL.createObjectURL(pendingFile) : null),
    [pendingFile],
  );

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const validationError = validateImageFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onSelect(file);
  };

  const shownUrl = previewUrl ?? (existingUrl || null);
  const frame = shape === "portrait" ? "h-24 w-16" : "h-16 w-28";

  const clear = () => {
    setError(null);
    onSelect(null);
    onClearExisting();
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {shownUrl ? (
        <div className="flex items-center gap-3 rounded border border-border bg-card/60 p-3">
          <div className={`${frame} flex shrink-0 items-center justify-center overflow-hidden rounded bg-black/40`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shownUrl} alt="" className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">
              {pendingFile ? pendingFile.name : existingUrl}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">
              {pendingFile ? "Uploads when you save" : "Current image"}
            </p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mt-1 text-[10px] font-bold uppercase tracking-widest text-primary hover:underline"
            >
              Replace
            </button>
          </div>
          <button
            type="button"
            onClick={clear}
            className="shrink-0 text-muted-foreground hover:text-red-400"
            aria-label="Remove image"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-border bg-card/40 px-4 py-6 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <ImageUp size={16} />
          {label}
        </button>
      )}

      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
