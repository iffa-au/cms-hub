'use client';

import { useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, ImageUp, Plus, Trash2, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { postData, updateData } from '@/lib/fetch-util';
import type { CrewEntry } from '@/lib/submission-pdf';

const INPUT =
  'w-full bg-background border border-border rounded px-3 py-2 text-white placeholder:text-[var(--placeholder)] focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all';
const LABEL = 'text-accent-foreground text-[10px] font-bold uppercase tracking-widest';

/** Matches the backend's STAFF_CREW_CONTENT_TYPES. */
const ACCEPTED_TYPES = ['image/webp', 'image/png', 'image/jpeg'];
/** Matches the backend's MAX_UPLOAD_BYTES, which the S3 policy also enforces. */
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_MB = Math.round(MAX_BYTES / (1024 * 1024));

export type CrewGroupKey = 'directors' | 'producers' | 'actors' | 'other';

export type CrewGroups = Record<CrewGroupKey, CrewEntry[]>;

/** Display order, which is also the order the PDF and public site use. */
const GROUPS: Array<{ key: CrewGroupKey; label: string }> = [
  { key: 'directors', label: 'Directors' },
  { key: 'producers', label: 'Producers' },
  { key: 'actors', label: 'Cast' },
  { key: 'other', label: 'Other Crew' },
];

export const EMPTY_CREW: CrewGroups = {
  directors: [],
  producers: [],
  actors: [],
  other: [],
};

/** Tolerates both a missing crew object and the crew-assignment array that
 *  `expand=crew` returns instead of the grouped object. */
export function toCrewGroups(value: unknown): CrewGroups {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...EMPTY_CREW };
  const source = value as Partial<Record<CrewGroupKey, unknown>>;
  const group = (v: unknown) => (Array.isArray(v) ? (v as CrewEntry[]) : []);
  return {
    directors: group(source.directors),
    producers: group(source.producers),
    actors: group(source.actors),
    other: group(source.other),
  };
}

/**
 * Photos uploaded through the form live in the media bucket and can be shown
 * inline. Roughly two thirds of existing entries are Google Drive share links
 * pasted into the public form instead — those are not direct image URLs, so
 * rendering them in an <img> produces a broken thumbnail. They get a link
 * chip until someone replaces them.
 */
function isDisplayableImage(url: string): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return hostname.endsWith('cloudfront.net') || hostname.includes('s3.');
  } catch {
    return false;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'external link';
  }
}

/** Axios surfaces the server's JSON body under `response.data`; a thrown
 *  Error (or an S3 failure) only has `message`. Both shapes turn up here. */
function errorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null) {
    const axiosBody = (err as { response?: { data?: { message?: unknown } } }).response?.data?.message;
    if (typeof axiosBody === 'string' && axiosBody) return axiosBody;
    const plain = (err as { message?: unknown }).message;
    if (typeof plain === 'string' && plain) return plain;
  }
  return fallback;
}

type PresignResponse = {
  success: boolean;
  uploadUrl: string;
  fields?: Record<string, string>;
  key: string;
  publicUrl: string;
  message?: string;
};

/**
 * Presigned POST, not PUT: the signed policy carries the size limit, so the
 * fields must travel with the file as multipart form data. Order matters —
 * S3 reads the policy fields and ignores anything after `file`.
 */
async function uploadCrewPhoto(
  submissionId: string,
  creditName: string,
  file: File,
): Promise<string> {
  const presign = await postData<PresignResponse>('/uploads/presign/submission-crew', {
    submissionId,
    name: creditName,
    contentType: file.type,
    contentLength: file.size,
  });
  if (!presign?.uploadUrl || !presign?.publicUrl) {
    throw new Error(presign?.message || 'Could not start upload');
  }

  const formData = new FormData();
  for (const [name, value] of Object.entries(presign.fields ?? {})) {
    formData.append(name, String(value));
  }
  formData.append('file', file);

  // Plain fetch, not the axios instance — S3 rejects the Authorization header
  // that fetch-util attaches to every request. Content-Type is deliberately
  // unset so the browser adds its own multipart boundary.
  const res = await fetch(presign.uploadUrl, { method: 'POST', body: formData });
  if (!res.ok) {
    if (res.status === 400) {
      const body = await res.text().catch(() => '');
      if (body.includes('EntityTooLarge')) {
        throw new Error(`That image is larger than the ${MAX_MB}MB limit.`);
      }
    }
    throw new Error('Upload to storage failed');
  }

  return presign.publicUrl;
}

type CrewEditorProps = {
  submissionId: string;
  initialCrew: CrewGroups;
  /** Called after a successful save with the crew that was persisted. */
  onSaved?: (crew: CrewGroups) => void;
  /** Rendered above the groups — lets the review queue title its modal. */
  heading?: string;
};

export default function CrewEditor({
  submissionId,
  initialCrew,
  onSaved,
  heading = 'Crew',
}: CrewEditorProps) {
  const [crew, setCrew] = useState<CrewGroups>(() => toCrewGroups(initialCrew));
  const [saved, setSaved] = useState<CrewGroups>(() => toCrewGroups(initialCrew));
  const [syncedFrom, setSyncedFrom] = useState(initialCrew);
  const [saving, setSaving] = useState(false);

  // A parent that renders this before its fetch resolves passes empty crew
  // first and the real crew a moment later. Without this the lazy useState
  // initialisers above would keep the empty snapshot forever — the editor
  // would show "0 people" for a film that has crew, and saving after adding
  // one person would replace the whole group, deleting the rest.
  //
  // Adjusting state during render is React's documented alternative to a
  // useEffect for this; it also avoids the set-state-in-effect lint rule.
  if (initialCrew !== syncedFrom) {
    setSyncedFrom(initialCrew);
    setCrew(toCrewGroups(initialCrew));
    setSaved(toCrewGroups(initialCrew));
  }
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const dirty = useMemo(
    () => JSON.stringify(crew) !== JSON.stringify(saved),
    [crew, saved],
  );

  const total = GROUPS.reduce((n, g) => n + crew[g.key].length, 0);

  const mutate = (group: CrewGroupKey, index: number, patch: Partial<CrewEntry>) => {
    setCrew((prev) => ({
      ...prev,
      [group]: prev[group].map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));
  };

  const addPerson = (group: CrewGroupKey) => {
    setCrew((prev) => ({
      ...prev,
      [group]: [...prev[group], { fullName: '', role: '', imageUrl: '', biography: '', instagramUrl: '', email: '' }],
    }));
    setCollapsed((prev) => ({ ...prev, [`${group}-${crew[group].length}`]: false }));
  };

  const removePerson = (group: CrewGroupKey, index: number) => {
    setCrew((prev) => ({ ...prev, [group]: prev[group].filter((_, i) => i !== index) }));
  };

  const pickPhoto = async (group: CrewGroupKey, index: number, file: File) => {
    const person = crew[group][index];
    if (!person.fullName.trim()) {
      toast.error('Add the person’s name before uploading their photo');
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error('Photo must be a WEBP, PNG or JPEG image');
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error(`Image is too large (max ${MAX_MB}MB)`);
      return;
    }

    // Same convention the public submit form uses, so replacing a photo
    // overwrites the existing object rather than orphaning it beside a new one.
    const creditName = `${person.role?.trim() || group}-${person.fullName.trim()}-${index + 1}`;
    const slot = `${group}-${index}`;
    setUploadingKey(slot);
    try {
      const url = await uploadCrewPhoto(submissionId, creditName, file);
      mutate(group, index, { imageUrl: url });
      toast.success('Photo uploaded — remember to save');
    } catch (err) {
      toast.error(errorMessage(err, 'Upload failed'));
    } finally {
      setUploadingKey(null);
    }
  };

  const save = async () => {
    if (saving) return;
    const cleaned: CrewGroups = { ...EMPTY_CREW };
    for (const { key } of GROUPS) {
      cleaned[key] = crew[key].filter((p) => p.fullName.trim());
    }
    const dropped = total - GROUPS.reduce((n, g) => n + cleaned[g.key].length, 0);

    setSaving(true);
    try {
      // All four groups always travel together: the API replaces `crew`
      // wholesale, so an omitted group would be cleared rather than kept.
      const res = await updateData<{ success: boolean; message?: string }>(
        `/submissions/${submissionId}`,
        { crew: cleaned },
      );
      if (!res?.success) throw new Error(res?.message || 'Save failed');
      setCrew(cleaned);
      setSaved(cleaned);
      onSaved?.(cleaned);
      toast.success(
        dropped > 0
          ? `Crew saved (${dropped} unnamed ${dropped === 1 ? 'entry' : 'entries'} discarded)`
          : 'Crew saved',
      );
    } catch (err) {
      toast.error(errorMessage(err, 'Failed to save crew'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className='space-y-8'>
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <div className='flex items-center gap-3'>
          <span className='inline-flex items-center justify-center w-7 h-7 rounded bg-[#2a261b]'>
            <UserRound className='h-4 w-4 text-primary' />
          </span>
          <h3 className='text-sm font-semibold'>{heading}</h3>
          <span className='text-xs font-medium text-label'>
            {total} {total === 1 ? 'person' : 'people'}
          </span>
        </div>
        <button
          type='button'
          onClick={save}
          disabled={saving || !dirty}
          className='inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40'
        >
          {saving ? 'Saving…' : dirty ? 'Save crew' : 'Saved'}
        </button>
      </div>

      {GROUPS.map(({ key, label }) => (
        <section key={key} className='space-y-3'>
          <div className='flex items-center justify-between'>
            <h4 className='text-sm font-semibold'>
              {label}{' '}
              <span className='text-muted-foreground font-normal'>({crew[key].length})</span>
            </h4>
            <button
              type='button'
              onClick={() => addPerson(key)}
              className='inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80'
            >
              <Plus className='h-3.5 w-3.5' /> Add
            </button>
          </div>

          {crew[key].length === 0 ? (
            <p className='text-sm text-muted-foreground italic'>None listed.</p>
          ) : (
            <div className='space-y-3'>
              {crew[key].map((person, index) => {
                const slot = `${key}-${index}`;
                const isCollapsed = collapsed[slot] ?? true;
                return (
                  <div key={slot} className='rounded border border-border bg-background'>
                    <div className='flex items-center gap-3 px-4 py-3'>
                      <button
                        type='button'
                        onClick={() => setCollapsed((p) => ({ ...p, [slot]: !isCollapsed }))}
                        className='text-label hover:text-primary shrink-0'
                        aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                      >
                        {isCollapsed ? <ChevronRight className='h-4 w-4' /> : <ChevronDown className='h-4 w-4' />}
                      </button>

                      <CrewThumb url={person.imageUrl ?? ''} />

                      <div className='min-w-0 flex-1'>
                        <div className='text-white font-medium truncate'>
                          {person.fullName || <span className='text-muted-foreground italic'>Unnamed</span>}
                        </div>
                        <div className='text-xs font-medium text-label truncate'>
                          {person.role || '—'}
                        </div>
                      </div>

                      <button
                        type='button'
                        onClick={() => removePerson(key, index)}
                        className='text-red-400 hover:text-red-300 shrink-0'
                        aria-label={`Remove ${person.fullName || 'crew member'}`}
                      >
                        <Trash2 className='h-4 w-4' />
                      </button>
                    </div>

                    {!isCollapsed && (
                      <div className='border-t border-border p-4 space-y-4'>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                          <div>
                            <label className={LABEL}>Full name</label>
                            <input
                              className={`${INPUT} mt-1.5`}
                              value={person.fullName}
                              onChange={(e) => mutate(key, index, { fullName: e.target.value })}
                              placeholder='e.g. Ada Lovelace'
                            />
                          </div>
                          <div>
                            <label className={LABEL}>Credited role</label>
                            <input
                              className={`${INPUT} mt-1.5`}
                              value={person.role ?? ''}
                              onChange={(e) => mutate(key, index, { role: e.target.value })}
                              placeholder='e.g. Director of Photography'
                            />
                          </div>
                          <div>
                            <label className={LABEL}>Instagram URL</label>
                            <input
                              className={`${INPUT} mt-1.5`}
                              value={person.instagramUrl ?? ''}
                              onChange={(e) => mutate(key, index, { instagramUrl: e.target.value })}
                              placeholder='https://instagram.com/…'
                            />
                          </div>
                          <div>
                            <label className={LABEL}>Email</label>
                            <input
                              className={`${INPUT} mt-1.5`}
                              value={person.email ?? ''}
                              onChange={(e) => mutate(key, index, { email: e.target.value })}
                              placeholder='name@example.com'
                            />
                          </div>
                        </div>

                        <div>
                          <label className={LABEL}>Biography</label>
                          <textarea
                            className={`${INPUT} mt-1.5 min-h-[80px] resize-y`}
                            value={person.biography ?? ''}
                            onChange={(e) => mutate(key, index, { biography: e.target.value })}
                          />
                        </div>

                        <CrewPhotoField
                          url={person.imageUrl ?? ''}
                          uploading={uploadingKey === slot}
                          onPick={(file) => pickPhoto(key, index, file)}
                          onClear={() => mutate(key, index, { imageUrl: '' })}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function CrewThumb({ url }: { url: string }) {
  if (isDisplayableImage(url)) {
    return (
      <img
        src={url}
        alt=''
        className='h-10 w-10 rounded object-cover border border-border shrink-0'
        loading='lazy'
      />
    );
  }
  return (
    <span className='h-10 w-10 rounded border border-border bg-surface-dark grid place-items-center shrink-0'>
      <UserRound className='h-4 w-4 text-[var(--placeholder)]' />
    </span>
  );
}

function CrewPhotoField({
  url,
  uploading,
  onPick,
  onClear,
}: {
  url: string;
  uploading: boolean;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const displayable = isDisplayableImage(url);

  return (
    <div>
      <label className={LABEL}>Photo</label>
      <div className='mt-1.5 flex flex-wrap items-center gap-3'>
        {displayable ? (
          <img src={url} alt='' className='h-16 w-16 rounded object-cover border border-border' />
        ) : url ? (
          <a
            href={url}
            target='_blank'
            rel='noreferrer'
            className='inline-flex items-center gap-1.5 text-xs text-primary underline max-w-[220px] truncate'
            title={url}
          >
            <ExternalLink className='h-3.5 w-3.5 shrink-0' />
            {hostOf(url)}
          </a>
        ) : (
          <span className='text-xs text-muted-foreground italic'>No photo</span>
        )}

        <input
          ref={inputRef}
          type='file'
          accept={ACCEPTED_TYPES.join(',')}
          className='hidden'
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Reset so picking the same file twice still fires a change event.
            e.target.value = '';
            if (file) onPick(file);
          }}
        />
        <button
          type='button'
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className='inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-foreground hover:border-primary disabled:opacity-50'
        >
          <ImageUp className='h-3.5 w-3.5' />
          {uploading ? 'Uploading…' : url ? 'Replace' : 'Upload'}
        </button>
        {url && !uploading && (
          <button
            type='button'
            onClick={onClear}
            className='text-xs font-medium text-muted-foreground hover:text-status-rejected'
          >
            Clear
          </button>
        )}
      </div>
      {url && !displayable && (
        <p className='mt-2 text-xs text-muted-foreground'>
          This is an external link, not an uploaded image, so it can’t be previewed here. Replacing it uploads a real
          file to the media bucket.
        </p>
      )}
    </div>
  );
}
