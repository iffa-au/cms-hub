"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-context";
import { getData, updateData } from "@/lib/fetch-util";
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  Pencil,
  Trash2,
  Plus,
  X,
  EyeOff,
} from "lucide-react";
import ConfirmDialog from "@/components/confirm-dialog";
import { uploadTrailer, validateTrailerFile } from "@/components/homepage-trailers/upload-trailer";

type Row = {
  uid: string; // _id, or `new-${n}` for unsaved rows (React key only, never sent)
  title: string;
  videoUrl: string;
  videoKey: string;
  youtubeUrl: string;
  learnMoreUrl: string;
  isHidden: boolean;
  pendingFile: File | null; // picked, not yet uploaded
};

type ManageTrailer = Omit<Row, "uid" | "pendingFile"> & { _id: string };

type ManageResponse = {
  success: boolean;
  data: ManageTrailer[];
  updatedAt: string | null;
  limits?: { maxEntries: number; maxVisible: number; maxBytes: number };
};

type SaveResponse = {
  success: boolean;
  message?: string;
  data: ManageTrailer[];
  updatedAt: string;
};

type Draft = {
  title: string;
  youtubeUrl: string;
  learnMoreUrl: string;
  isHidden: boolean;
  /** The row's saved video, if any — shown so staff know what "Replace" replaces. */
  videoUrl: string;
  videoKey: string;
  pendingFile: File | null;
};

const DEFAULT_MAX_ENTRIES = 10;
const DEFAULT_MAX_VISIBLE = 5;

const emptyDraft: Draft = {
  title: "",
  youtubeUrl: "",
  learnMoreUrl: "",
  isHidden: false,
  videoUrl: "",
  videoKey: "",
  pendingFile: null,
};

const toRow = (t: ManageTrailer): Row => ({
  uid: t._id,
  title: t.title,
  videoUrl: t.videoUrl,
  videoKey: t.videoKey ?? "",
  youtubeUrl: t.youtubeUrl ?? "",
  learnMoreUrl: t.learnMoreUrl ?? "",
  isHidden: Boolean(t.isHidden),
  pendingFile: null,
});

const errorMessage = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

const statusOf = (e: unknown) =>
  (e as { response?: { status?: number } } | null)?.response?.status;

/** Slot n for the nth visible row, "hidden", or "over" past the visible limit. */
const slotsOf = (rows: Row[], maxVisible: number): Array<number | "hidden" | "over"> => {
  let visible = 0;
  return rows.map((r) => {
    if (r.isHidden) return "hidden";
    visible += 1;
    return visible > maxVisible ? "over" : visible;
  });
};

const sourceLabel = (row: Row) => {
  if (row.pendingFile) return `New file: ${row.pendingFile.name} — uploads when you save`;
  return row.videoKey ? "MP4" : "HLS (imported)";
};

export default function HomepageTrailersPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [maxEntries, setMaxEntries] = useState(DEFAULT_MAX_ENTRIES);
  const [maxVisible, setMaxVisible] = useState(DEFAULT_MAX_VISIBLE);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [stale, setStale] = useState(false);
  const [uploading, setUploading] = useState<{ title: string; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingUid, setEditingUid] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formError, setFormError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const newRowCount = useRef(0);

  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [confirmReload, setConfirmReload] = useState(false);

  const isStaff = user?.role === "admin" || user?.role === "staff";

  useEffect(() => {
    if (isAuthenticated && !isStaff) router.replace("/");
  }, [isAuthenticated, isStaff, router]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      setStale(false);
      const res = await getData<ManageResponse>("/homepage-trailers/manage");
      setRows((res?.data ?? []).map(toRow));
      setUpdatedAt(res?.updatedAt ?? null);
      if (res?.limits?.maxEntries) setMaxEntries(res.limits.maxEntries);
      if (res?.limits?.maxVisible) setMaxVisible(res.limits.maxVisible);
      setDirty(false);
      setLoadFailed(false);
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to load homepage trailers"));
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // A tab close or reload would silently throw away an upload queue and edits.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // The panel sits above the list; editing row 8 shouldn't open it off-screen.
  useEffect(() => {
    if (formOpen) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [formOpen, editingUid]);

  const markChanged = () => {
    setDirty(true);
    setSuccess(null);
  };

  const moveRow = (from: number, to: number) => {
    if (from === to || to < 0 || to >= rows.length) return;
    setRows((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    markChanged();
  };

  const toggleHidden = (uid: string) => {
    setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, isHidden: !r.isHidden } : r)));
    markChanged();
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingUid(null);
    setDraft(emptyDraft);
    setFormError(null);
    setFileError(null);
  };

  const startCreate = () => {
    setDraft(emptyDraft);
    setEditingUid(null);
    setFormError(null);
    setFileError(null);
    setFormOpen(true);
    setSuccess(null);
  };

  const startEdit = (row: Row) => {
    setDraft({
      title: row.title,
      youtubeUrl: row.youtubeUrl,
      learnMoreUrl: row.learnMoreUrl,
      isHidden: row.isHidden,
      videoUrl: row.videoUrl,
      videoKey: row.videoKey,
      pendingFile: row.pendingFile,
    });
    setEditingUid(row.uid);
    setFormError(null);
    setFileError(null);
    setFormOpen(true);
    setSuccess(null);
  };

  const pickFile = (file: File | null) => {
    if (!file) return;
    const problem = validateTrailerFile(file);
    setFileError(problem);
    if (problem) {
      // Cleared so picking a corrected file with the same name still fires onChange.
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setDraft((d) => ({ ...d, pendingFile: file }));
  };

  const applyDraft = (e: React.FormEvent) => {
    e.preventDefault();
    const title = draft.title.trim();
    if (!title) {
      setFormError("Title is required");
      return;
    }
    if (!draft.pendingFile && !draft.videoUrl) {
      setFormError("Choose an MP4 video for this trailer");
      return;
    }
    const fields = {
      title,
      youtubeUrl: draft.youtubeUrl.trim(),
      learnMoreUrl: draft.learnMoreUrl.trim(),
      isHidden: draft.isHidden,
      pendingFile: draft.pendingFile,
    };
    if (editingUid) {
      setRows((prev) => prev.map((r) => (r.uid === editingUid ? { ...r, ...fields } : r)));
    } else {
      newRowCount.current += 1;
      setRows((prev) => [
        ...prev,
        { uid: `new-${newRowCount.current}`, videoUrl: "", videoKey: "", ...fields },
      ]);
    }
    markChanged();
    closeForm();
  };

  const removeRow = (uid: string) => {
    setRows((prev) => prev.filter((r) => r.uid !== uid));
    if (editingUid === uid) closeForm();
    markChanged();
  };

  const firstProblem = (list: Row[]): string | null => {
    for (const [i, row] of list.entries()) {
      if (!row.title.trim()) return `Trailer ${i + 1} needs a title`;
      if (!row.videoUrl && !row.pendingFile) return `“${row.title}” has no video — choose an MP4`;
    }
    const visible = list.filter((r) => !r.isHidden).length;
    if (visible > maxVisible) {
      return `Only ${maxVisible} trailers can be visible — hide or delete ${visible - maxVisible} before saving.`;
    }
    return null;
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(null);
    setStale(false);
    // An open draft was copied from rows before the save; applying it afterwards
    // would bring back a file that was just uploaded, or miss a row whose id the
    // save replaced.
    // The button is disabled while the form is open; this guards keyboard/stale clicks.
    if (formOpen) return;
    const problem = firstProblem(rows);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    try {
      // Each finished upload is written into `rows` straight away, so if a later
      // upload or the save itself fails, a retry doesn't upload it a second time.
      let working = rows;
      for (const row of rows) {
        if (!row.pendingFile) continue;
        const title = row.title.trim();
        setUploading({ title, pct: 0 });
        let uploaded: { key: string; url: string };
        try {
          uploaded = await uploadTrailer(row.pendingFile, title, (fraction) =>
            setUploading({ title, pct: Math.round(fraction * 100) }),
          );
        } catch (e: unknown) {
          setError(`Could not upload “${title}”: ${errorMessage(e, "Upload failed")}`);
          return;
        }
        working = working.map((r) =>
          r.uid === row.uid
            ? { ...r, videoKey: uploaded.key, videoUrl: uploaded.url, pendingFile: null }
            : r,
        );
        setRows(working);
      }
      setUploading(null);

      const res = await updateData<SaveResponse>("/homepage-trailers", {
        entries: working.map(({ title, videoUrl, videoKey, youtubeUrl, learnMoreUrl, isHidden }) => ({
          title,
          videoUrl,
          videoKey,
          youtubeUrl,
          learnMoreUrl,
          isHidden,
        })),
        updatedAt,
      });
      setRows((res?.data ?? []).map(toRow));
      setUpdatedAt(res?.updatedAt ?? null);
      setDirty(false);
      setSuccess("Saved — the homepage shows these trailers now.");
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to save homepage trailers"));
      if (statusOf(e) === 409) setStale(true);
    } finally {
      setSaving(false);
      setUploading(null);
    }
  };

  if (!isAuthenticated || !isStaff) return null;

  const atLimit = rows.length >= maxEntries;
  const editingRow = editingUid ? rows.find((r) => r.uid === editingUid) : undefined;
  const inputClass =
    "w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70";
  const iconButton =
    "p-1.5 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed";
  const slots = slotsOf(rows, maxVisible);

  return (
    <main className="mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 max-w-5xl">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Homepage trailers</h1>
          <p className="text-sm text-accent-foreground">
            The first five visible trailers fill the homepage&apos;s five trailer slots, in this
            order. Drag to reorder. Hidden trailers keep their video but don&apos;t appear.
          </p>
        </div>
        {!loading && !loadFailed && (
          <button
            onClick={startCreate}
            disabled={atLimit || saving}
            title={atLimit ? `At most ${maxEntries} trailers — delete one first` : undefined}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded bg-primary px-4 py-2 text-xs font-bold tracking-widest text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={14} /> ADD TRAILER
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 flex flex-col gap-2 rounded border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm text-red-400 sm:flex-row sm:items-center sm:justify-between">
          <p>{error}</p>
          {(stale || loadFailed) && (
            <button
              onClick={() => (dirty ? setConfirmReload(true) : void load())}
              className="shrink-0 self-start rounded border border-red-400/40 px-3 py-1 text-xs font-semibold hover:bg-red-400/10 sm:self-auto"
            >
              {loadFailed ? "Try again" : "Reload"}
            </button>
          )}
        </div>
      )}
      {success && (
        <p className="mb-4 rounded border border-green-400/30 bg-green-400/10 px-4 py-2 text-sm text-green-400">
          {success}
        </p>
      )}

      {formOpen && (
        <form
          ref={formRef}
          onSubmit={applyDraft}
          className="mb-8 scroll-mt-24 space-y-4 rounded-lg border border-border bg-card/60 p-4 sm:p-6"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {editingUid ? "Edit trailer" : "New trailer"}
            </h2>
            <button
              type="button"
              onClick={closeForm}
              className="text-muted-foreground hover:text-primary"
              aria-label="Close form"
            >
              <X size={16} />
            </button>
          </div>

          {formError && <p className="text-sm text-red-400">{formError}</p>}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor="trailer-title">
                Title *
              </label>
              <input
                id="trailer-title"
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                maxLength={120}
                className={inputClass}
                placeholder="e.g. Oman: A Global Filming Destination"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor="trailer-file">
                {editingUid ? "Replace video" : "Video file *"}
              </label>
              {editingRow && (draft.videoUrl || draft.pendingFile) && (
                <p className="mb-2 truncate text-xs text-muted-foreground">
                  Current:{" "}
                  {draft.pendingFile
                    ? `${draft.pendingFile.name} (uploads when you save)`
                    : draft.videoKey
                      ? "MP4 uploaded through the CMS"
                      : "HLS (imported)"}
                </p>
              )}
              <input
                id="trailer-file"
                ref={fileInputRef}
                type="file"
                accept="video/mp4"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                className="block w-full max-w-full text-sm text-muted-foreground file:mr-3 file:rounded file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-xs file:text-foreground hover:file:border-primary"
              />
              {!editingRow && draft.pendingFile && (
                <p className="mt-2 truncate text-xs text-foreground">
                  Selected: {draft.pendingFile.name}
                </p>
              )}
              {fileError && <p className="mt-2 text-xs text-red-400">{fileError}</p>}
              <p className="mt-2 text-xs text-muted-foreground">
                MP4 with H.264 video. Export with &apos;Fast start / Web optimized&apos; so it starts
                playing before it has fully downloaded. Max 200MB.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor="trailer-youtube">
                Watch Trailer link
              </label>
              <input
                id="trailer-youtube"
                value={draft.youtubeUrl}
                onChange={(e) => setDraft((d) => ({ ...d, youtubeUrl: e.target.value }))}
                className={inputClass}
                placeholder="https://www.youtube.com/watch?v=…"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor="trailer-learn-more">
                Learn More link
              </label>
              <input
                id="trailer-learn-more"
                value={draft.learnMoreUrl}
                onChange={(e) => setDraft((d) => ({ ...d, learnMoreUrl: e.target.value }))}
                className={inputClass}
                placeholder="/oman or https://…"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground md:col-span-2">
              <input
                type="checkbox"
                checked={draft.isHidden}
                onChange={(e) => setDraft((d) => ({ ...d, isHidden: e.target.checked }))}
              />
              Hide from homepage
            </label>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              APPLY
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border px-4 text-sm font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
            >
              CANCEL
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Apply adds this to the list below. Nothing changes on the homepage until you save.
          </p>
        </form>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-16 animate-pulse rounded bg-card/60" />
          <div className="h-16 animate-pulse rounded bg-card/60" />
        </div>
      ) : loadFailed ? null : (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-foreground">
            Trailers ({rows.length}/{maxEntries})
          </h2>

          {dirty && (
            <p className="mb-3 rounded border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-500">
              Unsaved changes — the homepage won&apos;t change until you save.
            </p>
          )}

          {rows.length === 0 ? (
            <p className="rounded border border-border bg-card/60 py-12 px-4 text-center text-sm text-muted-foreground">
              No trailers yet. Use “Add trailer” to add the first one.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row, i) => {
                const slot = slots[i];
                const badge =
                  slot === "hidden" ? (
                    <span className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
                      Hidden
                    </span>
                  ) : slot === "over" ? (
                    <span className="rounded border border-red-400/40 bg-red-400/10 px-1.5 py-0.5 text-xs text-red-400">
                      Over limit
                    </span>
                  ) : (
                    <span className="rounded border border-primary/40 px-1.5 py-0.5 text-xs text-primary">
                      Slot {slot}
                    </span>
                  );

                return (
                  <li
                    key={row.uid}
                    draggable={!saving}
                    onDragStart={(e) => {
                      setDragFrom(i);
                      e.dataTransfer.effectAllowed = "move";
                      // Firefox won't start a drag without some data attached.
                      e.dataTransfer.setData("text/plain", String(i));
                    }}
                    onDragOver={(e) => {
                      if (dragFrom === null) return;
                      e.preventDefault();
                      if (dragOver !== i) setDragOver(i);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragFrom !== null) moveRow(dragFrom, i);
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    onDragEnd={() => {
                      setDragFrom(null);
                      setDragOver(null);
                    }}
                    className={`flex flex-col gap-3 rounded border bg-card/60 p-3 sm:flex-row sm:items-center ${
                      dragOver === i && dragFrom !== i ? "border-primary" : "border-border"
                    } ${dragFrom === i ? "opacity-50" : ""} ${row.isHidden ? "bg-card/30" : ""}`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <GripVertical
                        size={16}
                        className="shrink-0 cursor-grab text-muted-foreground"
                        aria-hidden
                      />
                      <span className="shrink-0">{badge}</span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`truncate text-sm font-semibold ${
                            row.isHidden ? "text-muted-foreground" : "text-white"
                          }`}
                        >
                          {row.title}
                        </p>
                        <p
                          className={`truncate text-xs ${
                            row.pendingFile ? "text-yellow-500" : "text-muted-foreground"
                          }`}
                        >
                          {sourceLabel(row)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center justify-end gap-1">
                      <button
                        onClick={() => moveRow(i, i - 1)}
                        disabled={i === 0 || saving}
                        className={iconButton}
                        aria-label={`Move ${row.title} up`}
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        onClick={() => moveRow(i, i + 1)}
                        disabled={i === rows.length - 1 || saving}
                        className={iconButton}
                        aria-label={`Move ${row.title} down`}
                      >
                        <ChevronDown size={16} />
                      </button>
                      <button
                        onClick={() => startEdit(row)}
                        disabled={saving}
                        className={iconButton}
                        aria-label={`Edit ${row.title}`}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => toggleHidden(row.uid)}
                        disabled={saving}
                        className={`${iconButton} ${row.isHidden ? "text-primary" : ""}`}
                        aria-label={row.isHidden ? `Show ${row.title}` : `Hide ${row.title}`}
                        aria-pressed={row.isHidden}
                        title={row.isHidden ? "Show on homepage" : "Hide from homepage"}
                      >
                        <EyeOff size={15} />
                      </button>
                      <button
                        onClick={() => setPendingDelete(row)}
                        disabled={saving}
                        className="p-1.5 text-muted-foreground hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={`Delete ${row.title}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {uploading && (
            <div className="mt-4 rounded border border-border bg-card/60 px-4 py-3" role="status">
              <p className="truncate text-sm text-foreground">
                Uploading “{uploading.title}” — {uploading.pct}%
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded bg-black/40">
                <div
                  className="h-full bg-primary transition-[width]"
                  style={{ width: `${uploading.pct}%` }}
                />
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={!dirty || saving || formOpen}
            className="mt-6 w-full rounded bg-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest text-background transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
          {formOpen && dirty && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Apply or cancel the open trailer form to save.
            </p>
          )}
        </section>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        tone="danger"
        title="Remove this trailer?"
        description={
          !pendingDelete?.videoUrl
            ? `Remove “${pendingDelete?.title}”? Its video hasn't been uploaded yet, so nothing is deleted.`
            : pendingDelete.videoKey
              ? `Remove “${pendingDelete.title}” from the homepage? Its video file is deleted when you save.`
              : `Remove “${pendingDelete.title}” from the homepage? The original video files stay in storage.`
        }
        confirmLabel="Remove trailer"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const row = pendingDelete;
          setPendingDelete(null);
          if (row) removeRow(row.uid);
        }}
      />

      <ConfirmDialog
        open={confirmReload}
        tone="danger"
        title="Discard your changes?"
        description="Reloading shows the latest saved list and throws away the edits you haven't saved."
        confirmLabel="Discard and reload"
        onCancel={() => setConfirmReload(false)}
        onConfirm={() => {
          setConfirmReload(false);
          void load();
        }}
      />
    </main>
  );
}
