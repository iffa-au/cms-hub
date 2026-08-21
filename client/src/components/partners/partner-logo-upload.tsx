"use client";

import { useRef, useState } from "react";
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

type PartnerLogoUploadProps = {
  value: string;
  onChange: (logoUrl: string) => void;
};

export default function PartnerLogoUpload({ value, onChange }: PartnerLogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Logo must be a PNG, WEBP or JPEG image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image is too large (max 15MB).");
      return;
    }

    try {
      setUploading(true);
      const presign = await postData<PresignResponse>("/uploads/presign/partner", {
        contentType: file.type,
      });
      if (!presign?.uploadUrl || !presign?.publicUrl) {
        throw new Error(presign?.message || "Could not start upload");
      }

      // Plain fetch, not the axios instance — the presigned URL carries its
      // own auth in the query string and S3 rejects the extra Authorization
      // header that fetch-util attaches to every request.
      const put = await fetch(presign.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("Upload to storage failed");

      onChange(presign.publicUrl);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      {value ? (
        <div className="flex items-center gap-3 rounded border border-border bg-card/60 p-3">
          <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded bg-black/40 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Partner logo" className="max-h-full max-w-full object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{value}</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="mt-1 text-[10px] font-bold uppercase tracking-widest text-primary hover:underline disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Replace"}
            </button>
          </div>
          <button
            type="button"
            onClick={() => onChange("")}
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
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-border bg-card/40 px-4 py-6 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <ImageUp size={16} />
          {uploading ? "Uploading..." : "Upload logo (PNG, WEBP or JPEG)"}
        </button>
      )}

      {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
  );
}
