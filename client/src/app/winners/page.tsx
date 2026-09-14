'use client';

import { useEffect, useState } from 'react';
import { getData } from '@/lib/fetch-util';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/auth-context';

type ContentType = { _id: string; name: string };
type Winner = {
  _id: string;
  submissionId: string;
  submissionTitle?: string | null;
  submissionSynopsis?: string | null;
  year: number;
  isWinner: boolean;
  awardCategoryName?: string | null;
  crewMemberName?: string | null;
};

type ListResponse = {
  success: boolean;
  data: Winner[];
  meta?: { page: number; limit: number; total: number };
};

export default function WinnersListPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [items, setItems] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageMeta, setPageMeta] = useState<{ page: number; limit: number; total: number } | null>(null);

  // Restrict to admin/staff
  useEffect(() => {
    if (user && user.role !== 'admin' && user.role !== 'staff') {
      router.replace('/dashboard');
    }
  }, [router, user]);

  // filters
  const [contentTypeId, setContentTypeId] = useState<string>('');
  const [year, setYear] = useState<string>('');

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const qs = [
        'page=1',
        // Winners are a small set; request the endpoint max so the default
        // "all years" view is never silently truncated.
        'limit=100',
        ...(contentTypeId ? [`contentTypeId=${encodeURIComponent(contentTypeId)}`] : []),
        ...(year.trim() ? [`year=${encodeURIComponent(year.trim())}`] : []),
      ].join('&');
      // Dedicated winners endpoint: always isWinner-scoped and, unlike
      // /nominations, safe to filter by year (that route falls back to the
      // public feed on a year query).
      const res = await getData<ListResponse>(`/winners?${qs}`);
      setItems(res?.data ?? []);
      setPageMeta(res?.meta ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load winners');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const ct = await getData<{ success: boolean; data: ContentType[] }>(`/content-types`);
        setContentTypes(ct?.data ?? []);
      } catch {
        // ignore
      }
      await load();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showingStart = items.length === 0 ? 0 : 1;
  const showingEnd = items.length;
  const total = pageMeta?.total ?? items.length;

  return (
    <main className='flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full'>
      <div className='flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4'>
        <div>
          <h1 className='font-serif text-3xl md:text-4xl text-white mb-2'>Winners</h1>
          <p className='text-accent-foreground text-sm'>Award winners across all editions and content types.</p>
        </div>
      </div>

      {/* Filters */}
      <div className='rounded border border-border bg-surface-dark p-4 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4'>
        <div>
          <label className='text-accent-foreground text-xs font-bold uppercase tracking-widest'>Content Type</label>
          <select
            className='w-full bg-[#0a0a0a] border border-[#393528] rounded px-4 py-3 text-white mt-2'
            value={contentTypeId}
            onChange={(e) => setContentTypeId(e.target.value)}
          >
            <option value=''>All</option>
            {contentTypes.map((ct) => (
              <option key={ct._id} value={ct._id}>
                {ct.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className='text-accent-foreground text-xs font-bold uppercase tracking-widest'>Edition Year</label>
          <input
            className='w-full bg-[#0a0a0a] border border-[#393528] rounded px-4 py-3 text-white mt-2'
            placeholder='e.g. 2026'
            inputMode='numeric'
            value={year}
            onChange={(e) => setYear(e.target.value)}
          />
        </div>
        <div className='md:col-span-2 flex items-end justify-end gap-2'>
          <button
            onClick={() => void load()}
            className='bg-foreground text-background px-6 py-2.5 rounded text-xs font-bold tracking-widest hover:opacity-90 transition-opacity'
          >
            APPLY
          </button>
          <button
            onClick={() => {
              setContentTypeId('');
              setYear('');
              void load();
            }}
            className='px-6 py-2.5 rounded bg-[#222] text-white hover:bg-[#333] border border-border text-xs font-bold tracking-widest'
          >
            RESET
          </button>
        </div>
      </div>

      <div className='overflow-x-auto'>
        <table className='w-full text-left border-separate border-spacing-y-2'>
          <thead>
            <tr className='text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold'>
              <th className='px-4 py-3'>Title</th>
              <th className='px-4 py-3'>Award Category</th>
              <th className='px-4 py-3'>Edition Year</th>
              <th className='px-4 py-3 text-right'>Actions</th>
            </tr>
          </thead>
          <tbody className='text-sm'>
            {loading && (
              <tr className='bg-card/60'>
                <td className='px-4 py-6' colSpan={4}>
                  <div className='animate-pulse h-4 w-1/3 bg-border rounded mb-3' />
                  <div className='animate-pulse h-3 w-2/3 bg-border rounded' />
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr className='bg-card/60'>
                <td className='px-4 py-6' colSpan={4}>
                  <span className='text-red-400 text-sm'>{error}</span>
                </td>
              </tr>
            )}
            {!loading && !error && items.length === 0 && (
              <tr className='bg-card/60'>
                <td className='px-4 py-6' colSpan={4}>
                  <span className='text-muted-foreground text-sm'>No winners found.</span>
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              items.map((w) => (
                <tr key={w._id} className='bg-card/60'>
                  <td className='px-4 py-6 border-l-2 border-primary'>
                    <div className='text-white font-serif font-bold'>{w.submissionTitle || '—'}</div>
                    <div className='text-xs text-muted-foreground line-clamp-1 max-w-xl'>
                      {w.submissionSynopsis || '—'}
                    </div>
                  </td>
                  <td className='px-4 py-6'>{w.awardCategoryName || '—'}</td>
                  <td className='px-4 py-6'>{w.year}</td>
                  <td className='px-4 py-6 text-right'>
                    <div className='flex items-center justify-end'>
                      <button
                        onClick={() => router.push(`/winners/${w._id}`)}
                        className='text-primary hover:text-foreground transition-colors text-[10px] font-bold tracking-widest'
                      >
                        MANAGE
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className='mt-8 flex items-center justify-between border-t border-border pt-6'>
        <span className='text-xs text-muted-foreground tracking-wider'>
          {`SHOWING ${showingStart}-${showingEnd} OF ${total} WINNERS`}
        </span>
      </div>
    </main>
  );
}
