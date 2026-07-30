'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getData, patchData } from '@/lib/fetch-util';
import {
  buildSubmissionPdf,
  sanitizeSubmissionFileName,
  type CrewEntry,
  type SubmissionOverview,
} from '@/lib/submission-pdf';

type OverviewResponse = {
  success: boolean;
  data: SubmissionOverview;
  message?: string;
};

const LABEL = 'text-accent-foreground text-xs font-bold uppercase tracking-widest';
const VALUE = 'text-white mt-1';
const CARD = 'rounded-xl border border-border bg-surface-dark/80 p-6';
const SECTION_TITLE = 'uppercase tracking-widest font-bold text-sm text-primary';

const WATCH_FORMAT_LABELS: Record<string, string> = {
  theatrical: 'Theatrical',
  ott: 'OTT / Streaming',
  tv: 'TV',
  festival: 'Festival only',
  other: 'Other',
};

const getErrorMessage = (value: unknown, fallback: string) => {
  if (value instanceof Error && value.message) return value.message;
  if (
    typeof value === 'object' &&
    value &&
    'message' in value &&
    typeof (value as { message?: unknown }).message === 'string'
  ) {
    return String((value as { message?: string }).message);
  }
  return fallback;
};

const formatSubmittedAt = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
};

const formatReleaseDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
};

const formatWatchFormats = (formats?: string[]) => {
  if (!formats || formats.length === 0) return '—';
  return formats
    .map((format) => WATCH_FORMAT_LABELS[format] || format.charAt(0).toUpperCase() + format.slice(1))
    .join(', ');
};

const valueOrDash = (value?: string | null) => {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || '—';
};

function Field({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className={LABEL}>{label}</p>
      <p className={`${VALUE} whitespace-pre-wrap`}>{value}</p>
    </div>
  );
}

function UrlField({ label, value }: { label: string; value?: string }) {
  const text = valueOrDash(value);
  return (
    <div className='min-w-0'>
      <p className={LABEL}>{label}</p>
      {text === '—' ? (
        <p className={VALUE}>{text}</p>
      ) : (
        <a
          href={text}
          target='_blank'
          rel='noopener noreferrer'
          className={`${VALUE} break-all underline hover:text-primary transition-colors`}
        >
          {text}
        </a>
      )}
    </div>
  );
}

export default function ViewSubmissionPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const searchParams = useSearchParams();
  const from = searchParams?.get('from');

  const [details, setDetails] = useState<SubmissionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejectConfirmOpen, setIsRejectConfirmOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        // NOTE: `expand=crew` makes the backend overwrite `crew` with the crew-assignment
        // array, discarding the grouped proposed crew stored on the submission itself.
        // `expand=meta` is what the edit page uses and what the crew section needs.
        const res = await getData<OverviewResponse>(`/submissions/${id}/overview?expand=meta`);
        if (!cancelled) setDetails(res?.data ?? null);
      } catch (e: unknown) {
        if (!cancelled) setError(getErrorMessage(e, 'Failed to load submission'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (id) void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const onDownload = async () => {
    try {
      setError(null);
      setIsDownloading(true);
      const response = await getData<OverviewResponse>(`/submissions/${id}/overview?expand=meta`);
      const data = response?.data;
      if (!data) {
        throw new Error('Submission details are unavailable');
      }

      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      buildSubmissionPdf(doc, data);

      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `${sanitizeSubmissionFileName(data.title)}_${data._id}_${timestamp}.pdf`;
      doc.save(fileName);
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to generate PDF'));
    } finally {
      setIsDownloading(false);
    }
  };

  const approve = async () => {
    try {
      setError(null);
      setIsApproving(true);
      await patchData(`/submissions/${id}/approve`, {});
      router.push('/review-queue');
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to approve submission'));
    } finally {
      setIsApproving(false);
    }
  };

  const reject = async () => {
    try {
      setError(null);
      await patchData(`/submissions/${id}/reject`, {});
      router.push('/review-queue');
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to reject submission'));
    }
  };

  const goBack = () => {
    if (from === 'review-queue') {
      router.push('/review-queue');
      return;
    }
    if (from === 'archive') {
      router.push('/review-queue/archive');
      return;
    }
    router.push('/dashboard');
  };

  // Tolerate the crew-assignment array shape the API returns when `expand=crew` is used.
  const crew = details?.crew && !Array.isArray(details.crew) ? details.crew : undefined;
  const crewGroups: Array<[string, CrewEntry[]]> = [
    ['Directors', crew?.directors ?? []],
    ['Actors', crew?.actors ?? []],
    ['Producers', crew?.producers ?? []],
    ['Other', crew?.other ?? []],
  ];
  const hasCrew = crewGroups.some(([, list]) => list.length > 0);
  const genres = details?.genres ?? [];

  return (
    <main className='flex-1 w-full overflow-y-auto px-6 py-10 lg:px-10 scroll-smooth'>
      <div className='max-w-6xl mx-auto pb-24'>
        <div className='flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8'>
          <div>
            <h1 className='font-serif text-3xl md:text-4xl text-white mb-2'>Film Details</h1>
            <p className='text-accent-foreground text-sm'>Submission details from the filmmaker.</p>
          </div>
          <div className='flex items-center gap-3'>
            <button
              onClick={() => router.push(`/submissions/${id}/edit?from=${from || 'review-queue'}`)}
              className='rounded-lg border border-border text-foreground px-4 py-2 text-xs font-bold tracking-widest hover:border-primary transition-colors'
            >
              EDIT
            </button>
            <button
              onClick={() => void onDownload()}
              disabled={isDownloading || !details}
              className='rounded-lg bg-primary text-primary-foreground px-4 py-2 text-xs font-bold tracking-widest hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity'
            >
              {isDownloading ? 'DOWNLOADING...' : 'DOWNLOAD PDF'}
            </button>
            {from === 'review-queue' && (
              <>
                <button
                  onClick={() => void approve()}
                  disabled={isApproving || !details}
                  className='rounded-lg border border-green-500 text-green-500 px-4 py-2 text-xs font-bold tracking-widest hover:bg-green-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                >
                  {isApproving ? 'APPROVING...' : 'APPROVE'}
                </button>
                <button
                  onClick={() => setIsRejectConfirmOpen(true)}
                  disabled={!details}
                  className='rounded-lg border border-red-500 text-red-500 px-4 py-2 text-xs font-bold tracking-widest hover:bg-red-500 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                >
                  REJECT
                </button>
              </>
            )}
          </div>
        </div>

        {error && <p className='text-red-400 text-sm mb-4'>{error}</p>}

        {loading && (
          <div className={`${CARD} space-y-3`}>
            <div className='animate-pulse h-4 w-1/3 bg-border rounded' />
            <div className='animate-pulse h-3 w-2/3 bg-border rounded' />
            <div className='animate-pulse h-3 w-1/2 bg-border rounded' />
          </div>
        )}

        {!loading && !details && !error && (
          <p className='text-muted-foreground text-sm'>Submission not found.</p>
        )}

        {!loading && details && (
          <div className='flex flex-col gap-8'>
            {/* Info bar */}
            <section className={`${CARD} grid grid-cols-1 md:grid-cols-2 gap-4 text-sm`}>
              <Field label='Submitted' value={formatSubmittedAt(details.createdAt)} />
              <Field
                label='Countries of Release'
                value={
                  details.releaseCountries && details.releaseCountries.length > 0
                    ? details.releaseCountries.map((c) => c.name).join(', ')
                    : '—'
                }
              />
              <Field label='Watch Formats' value={formatWatchFormats(details.watchFormats)} />
              <Field label='Additional Notes' value={valueOrDash(details.notes)} className='md:col-span-2' />
            </section>

            {/* Basic Information */}
            <section className={CARD}>
              <h2 className={SECTION_TITLE}>Basic Information</h2>
              <div className='mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm'>
                <Field label='Film Title' value={valueOrDash(details.title)} />
                <Field label='Release Date' value={formatReleaseDate(details.releaseDate)} />
                <Field label='Synopsis' value={valueOrDash(details.synopsis)} className='md:col-span-2' />
                <Field label='Production House' value={valueOrDash(details.productionHouse)} />
                <Field label='Distributor' value={valueOrDash(details.distributor)} />
              </div>
            </section>

            {/* Media & Links */}
            <section className={CARD}>
              <h2 className={SECTION_TITLE}>Media &amp; Links</h2>
              <div className='mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm'>
                <UrlField label='Portrait Image URL' value={details.potraitImageUrl} />
                <UrlField label='Landscape Image URL' value={details.landscapeImageUrl} />
                <UrlField label='IMDb URL' value={details.imdbUrl} />
                <UrlField label='Trailer URL' value={details.trailerUrl} />
              </div>
            </section>

            {/* Classification */}
            <section className={CARD}>
              <h2 className={SECTION_TITLE}>Classification</h2>
              <div className='mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm'>
                <Field label='Language' value={valueOrDash(details.language?.name)} />
                <Field label='Country of Origin' value={valueOrDash(details.country?.name)} />
                <Field label='Content Type' value={valueOrDash(details.contentType?.name)} />
              </div>
              <div className='mt-6'>
                <p className={LABEL}>Genres</p>
                <div className='flex flex-wrap gap-2 mt-2'>
                  {genres.length > 0 ? (
                    genres.map((genre) => (
                      <span
                        key={genre._id}
                        className='px-2 py-0.5 border border-border rounded-full text-[10px] text-primary uppercase font-semibold'
                      >
                        {genre.name}
                      </span>
                    ))
                  ) : (
                    <span className='px-2 py-0.5 border border-border rounded-full text-[10px] text-primary uppercase font-semibold'>
                      —
                    </span>
                  )}
                </div>
              </div>
            </section>

            {/* Proposed Crew */}
            {hasCrew && (
              <section className={CARD}>
                <h2 className={SECTION_TITLE}>Proposed Crew</h2>
                <div className='mt-6 space-y-8'>
                  {crewGroups.map(([group, list]) =>
                    list.length > 0 ? (
                      <div key={group} className='space-y-4'>
                        <h3 className='text-white font-semibold tracking-widest uppercase text-sm'>{group}</h3>
                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                          {list.map((member, idx) => (
                            <div
                              key={`${group}-${idx}-${member.fullName}`}
                              className='rounded-lg border border-border p-4 text-sm'
                            >
                              <div className='flex items-baseline justify-between gap-3'>
                                <p className='text-white font-medium'>{valueOrDash(member.fullName)}</p>
                                <p className='text-xs uppercase tracking-widest text-accent-foreground shrink-0'>
                                  {valueOrDash(member.role)}
                                </p>
                              </div>
                              {member.biography ? (
                                <p className='text-muted-foreground mt-2 whitespace-pre-wrap'>{member.biography}</p>
                              ) : null}
                              {member.instagramUrl ? (
                                <a
                                  href={member.instagramUrl}
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  className='text-muted-foreground text-xs mt-2 block break-all underline hover:text-primary transition-colors'
                                >
                                  {member.instagramUrl}
                                </a>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null,
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        <div className='mt-10'>
          <button
            onClick={goBack}
            className='text-muted-foreground hover:text-primary transition-colors text-xs font-bold tracking-widest'
          >
            ← BACK
          </button>
        </div>
      </div>

      {isRejectConfirmOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsRejectConfirmOpen(false);
          }}
          className='fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center'
        >
          <div className='bg-card border border-border rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl'>
            <h2 className='text-white font-serif text-xl font-bold mb-2'>Reject Submission</h2>
            <p className='text-foreground text-sm'>
              Are you sure you want to reject:
              <br />
              <span className='text-primary font-semibold'>{details?.title}</span>
            </p>
            <p className='text-muted-foreground text-sm mt-2'>This action cannot be undone.</p>
            <div className='flex justify-end gap-3 mt-6'>
              <button
                onClick={() => setIsRejectConfirmOpen(false)}
                className='px-5 py-2.5 rounded border border-border text-foreground text-xs font-bold tracking-widest hover:border-primary transition-colors'
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  setIsRejectConfirmOpen(false);
                  void reject();
                }}
                className='px-5 py-2.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold tracking-widest transition-colors'
              >
                REJECT
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
