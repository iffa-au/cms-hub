"use client";

import { useEffect, useRef, useState } from "react";
import { ImageUp, X } from "lucide-react";
import { postData } from "@/lib/fetch-util";

const ACCEPTED_TYPES = ["image/webp", "image/png", "image/jpeg"];
const MAX_BYTES = 15 * 1024 * 1024; // keep in sync with backend MAX_UPLOAD_BYTES

type PresignResponse = {
  success: boolean;
  uploadUrl: string;
  key: string;
  publicUrl: string;
  message?: string;
};

export type UploadedLogo = { url: string; key: string };

/**
 * Uploads a confirmed logo to S3 and resolves to its public URL and object
 * key. Called from the partners page at save time, not on file selection —
 * an admin who picks a logo and then abandons the form should never leave a
 * file behind in the bucket.
 */
export async function uploadPartnerLogo(file: File): Promise<UploadedLogo> {
  const presign = await postData<PresignResponse>("/uploads/presign/partner", {
    contentType: file.type,
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

export function validateLogoFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Logo must be a PNG, WEBP or JPEG image.";
  }
  if (file.size > MAX_BYTES) return "Image is too large (max 15MB).";
  return null;
}

type PartnerLogoUploadProps = {
  /** Currently saved logo URL, if editing an existing partner. */
  existingUrl: string;
  /** Newly picked file, not yet uploaded. */
  pendingFile: File | null;
  onSelect: (file: File | null) => void;
  onClearExisting: () => void;
};

export default function PartnerLogoUpload({
  existingUrl,
  pendingFile,
  onSelect,
  onClearExisting,
}: PartnerLogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Local preview for the pending file — no network involved.
  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingFile]);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const validationError = validateLogoFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    onSelect(file);
  };

  const shownUrl = previewUrl ?? (existingUrl || null);

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
          <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded bg-black/40 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shownUrl} alt="Partner logo" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">
              {pendingFile ? pendingFile.name : existingUrl}
            </p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground/70">
              {pendingFile ? "Uploads when you save" : "Current logo"}
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
            aria-label="Remove logo"
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
          Select logo (PNG, WEBP or JPEG)
        </button>
      )}

      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
