'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getData, postData, updateData } from '@/lib/fetch-util';
import { toast } from 'sonner';

const CARD =
  "rounded-xl border border-border bg-surface-dark overflow-hidden shadow-2xl shadow-black/50";
const SECTION_HEADER =
  "px-8 py-6 border-b border-border flex justify-between items-center bg-surface-dark";
const LABEL = "text-accent-foreground text-xs font-bold uppercase tracking-widest";
const INPUT =
  "w-full bg-[#0a0a0a] border border-[#393528] rounded px-4 py-3 text-white placeholder-[#544e3b] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all mt-2";

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
    <main className="flex-1 w-full overflow-y-auto px-6 py-10 lg:px-10 scroll-smooth">
      <div className="max-w-5xl mx-auto pb-24">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-3xl lg:text-4xl font-serif font-bold leading-tight tracking-wide">
            {editId ? "Edit Crew Member" : "Add New Crew Member"}
          </h2>
          <div className="flex gap-3">
            <button
              className="px-6 py-3 rounded bg-[#222] text-white hover:bg-[#333] border border-border font-bold uppercase tracking-widest text-xs"
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="px-6 py-3 rounded bg-primary text-black hover:bg-[#d9a50b] font-bold uppercase tracking-widest text-xs disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? "Saving..." : editId ? "Update Member" : "Save Member"}
            </button>
          </div>
        </div>

        <section className={CARD}>
          <div className={SECTION_HEADER}>
            <h3 className="text-white text-lg font-bold tracking-widest uppercase font-serif">
              Profile Details
            </h3>
          </div>
          <div className="p-8 grid grid-cols-1 gap-8">
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
                className="w-full bg-[#0a0a0a] border border-[#393528] rounded px-4 py-3 text-white placeholder-[#544e3b] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none mt-2"
                placeholder="Write a brief biography about the crew member..."
                rows={6}
                value={biography}
                onChange={(e) => setBiography(e.target.value)}
              />
            </div>
            {error ? <p className="text-red-500">{error}</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

