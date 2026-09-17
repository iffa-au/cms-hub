'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getData, postData, updateData } from '@/lib/fetch-util';
import { toast } from 'sonner';
import PageShell from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/form-section";

const CARD = "overflow-hidden rounded-xl border border-border bg-surface-dark";
const SECTION_HEADER = "flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6";
const LABEL = labelClass;
const INPUT = inputClass;

export default function CreateCrewMemberPage() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next');
  const editId = search.get('id');

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [profilePicture, setProfilePicture] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [biography, setBiography] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getData<{ success: boolean; data?: any; message?: string }>(`/crew-members/${editId}`);
        const d = res?.data;
        if (d && !cancelled) {
          setName(d.name ?? '');
          setDescription(d.description ?? '');
          setProfilePicture(d.profilePicture ?? '');
          setInstagramUrl(d.instagramUrl ?? '');
          setBiography(d.biography ?? '');
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId]);

  const onCancel = () => {
    if (next) router.replace(next);
    else router.back();
  };

  const onSave = async () => {
    if (!name.trim()) {
      setError("Full name is required");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      let ok = false;
      if (editId) {
        const res = await updateData<{
          success: boolean;
          data?: { _id: string };
          message?: string;
        }>(`/crew-members/${editId}`, {
          name: name.trim(),
          description: description.trim(),
          profilePicture: profilePicture.trim(),
          instagramUrl: instagramUrl.trim(),
          biography: biography.trim(),
        });
        ok = !!(res as any)?.success;
        if (!ok) setError((res as any)?.message || "Failed to update member");
        else toast.success("Crew member updated");
      } else {
        const res = await postData<{
          success: boolean;
          data?: { _id: string };
          message?: string;
        }>("/crew-members", {
          name: name.trim(),
          description: description.trim(),
          profilePicture: profilePicture.trim(),
          instagramUrl: instagramUrl.trim(),
          biography: biography.trim(),
        });
        ok = !!(res as any)?.success;
        if (!ok) setError((res as any)?.message || "Failed to create member");
        else toast.success("Crew member created");
      }
      if (ok) {
        if (next) router.replace(next);
        else router.replace("/submissions");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || (editId ? "Failed to update member" : "Failed to create member"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell
      width="medium"
      title={editId ? "Edit crew member" : "Add a crew member"}
      actions={
        <>
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Saving\u2026" : editId ? "Update member" : "Save member"}
          </Button>
        </>
      }
    >

        <section className={CARD}>
          <div className={SECTION_HEADER}>
            <h3 className="text-sm font-semibold">
              Profile Details
            </h3>
          </div>
          <div className="grid grid-cols-1 gap-5 p-4 sm:gap-6 sm:p-6">
            <div className="space-y-2">
              <label className={LABEL}>Full Name</label>
              <input
                className={INPUT}
                placeholder="e.g. Christopher Nolan"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className={LABEL}>Short Description</label>
              <input
                className={INPUT}
                placeholder="One-liner for quick reference"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className={LABEL}>Profile Image URL</label>
                <input
                  className={INPUT}
                  placeholder="https://example.com/image.jpg"
                  value={profilePicture}
                  onChange={(e) => setProfilePicture(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Direct link to the image file (JPG, PNG)
                </p>
              </div>
              <div className="space-y-2">
                <label className={LABEL}>Instagram URL</label>
                <input
                  className={INPUT}
                  placeholder="https://instagram.com/username"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Public profile link (optional)
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <label className={LABEL}>Biography</label>
              <textarea
                className="w-full bg-background border border-border rounded px-4 py-3 text-white placeholder:text-[var(--placeholder)] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none mt-2"
                placeholder="Write a brief biography about the crew member..."
                rows={6}
                value={biography}
                onChange={(e) => setBiography(e.target.value)}
              />
            </div>
            {error ? <p className="text-red-500">{error}</p> : null}
          </div>
        </section>
    </PageShell>
  );
}
