'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getData } from '@/lib/fetch-util';

type Submission = {
  _id: string;
  title: string;
  synopsis?: string;
  releaseDate?: string;
  contentTypeId?: string;
  genreId?: string;
  contentTypeName?: string | null;
  genreNames?: string[];
};

type ListResponse = {
  success: boolean;
  message?: string;
  data: Submission[];
  meta?: { page: number; limit: number; total: number };
};

export default function SubmissionsPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageMeta, setPageMeta] = useState<{ page: number; limit: number; total: number } | null>(null);

  async function load(q?: string) {
    try {
      setLoading(true);
      setError(null);
      const parts = [`page=1`, `limit=20`, `status=APPROVED`];
      if (q && q.trim()) parts.push(`q=${encodeURIComponent(q.trim())}`);
      const res = await getData<ListResponse>(`/submissions?${parts.join('&')}`);
      setItems(res?.data ?? []);
      setPageMeta(res?.meta ?? null);
    } catch (e: any) {
      setError(e?.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await load();
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const showingStart = items.length === 0 ? 0 : 1;
  const showingEnd = items.length;
  const total = pageMeta?.total ?? items.length;

  return (
    <main className='flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full'>
      <div className='flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4'>
        <div>
          <h1 className='font-serif text-3xl md:text-4xl text-white mb-2'>Content Library</h1>
          <p className='text-accent-foreground text-sm'>Manage feature films, shorts, series, and historical archives.</p>
        </div>
        <button className='bg-primary hover:opacity-90 text-black px-6 py-2.5 rounded font-bold text-sm tracking-widest transition-all transform hover:scale-105 shadow-lg shadow-primary/20 flex items-center gap-2'>
          ADD CONTENT
        </button>
      </div>

      {/* Search bar (title-only) */}
      <div className='bg-card p-2 rounded border border-border mb-8 flex items-center gap-2'>
        <div className='relative grow'>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void load(query);
              }
            }}
            className='w-full bg-transparent border-none focus:ring-0 pl-3 text-sm text-foreground placeholder:text-muted-foreground/70 py-3'
            placeholder='Search by title...'
            type='text'
          />
        </div>
        <button
          onClick={() => {
            setQuery('');
            void load('');
          }}
          className='px-4 py-2 text-muted-foreground hover:text-primary transition-colors border-l border-border text-xs font-semibold tracking-widest'
        >
          CLEAR
        </button>
        <button
          onClick={() => void load(query)}
          className='bg-foreground text-background px-6 py-2.5 rounded text-xs font-bold tracking-widest hover:opacity-90 transition-opacity'
        >
          SEARCH
        </button>
      </div>

      {/* Table */}
      <div className='overflow-x-auto'>
        <table className='w-full text-left border-separate border-spacing-y-2'>
          <thead>
            <tr className='text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold'>
              <th className='px-4 py-3'>Film Details</th>
              <th className='px-4 py-3'>Content Type</th>
              <th className='px-4 py-3 text-center'>Release</th>
              <th className='px-4 py-3'>Genres</th>
              <th className='px-4 py-3 text-right'>Actions</th>
            </tr>
          </thead>
          <tbody className='text-sm'>
            {loading && (
              <tr className='bg-card/60'>
                <td className='px-4 py-6' colSpan={5}>
                  <div className='animate-pulse h-4 w-1/3 bg-border rounded mb-3' />
                  <div className='animate-pulse h-3 w-2/3 bg-border rounded' />
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr className='bg-card/60'>
                <td className='px-4 py-6' colSpan={5}>
                  <span className='text-red-400 text-sm'>{error}</span>
                </td>
              </tr>
            )}
            {!loading && !error && items.length === 0 && (
              <tr className='bg-card/60'>
                <td className='px-4 py-6' colSpan={5}>
                  <span className='text-muted-foreground text-sm'>No submissions found.</span>
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              items.map((item) => {
                const release = item.releaseDate ? new Date(item.releaseDate).getFullYear().toString() : '—';
                return (
                  <tr key={item._id} className='bg-card/60'>
                    <td className='px-4 py-6 border-l-2 border-primary'>
                      <h3 className='font-serif text-primary font-bold text-lg mb-1'>{item.title}</h3>
                      {item.synopsis ? (
                        <p className='text-muted-foreground text-xs line-clamp-1 max-w-md'>{item.synopsis}</p>
                      ) : (
                        <p className='text-muted-foreground text-xs line-clamp-1 max-w-md'>—</p>
                      )}
                    </td>
                    <td className='px-4 py-6'>
                      <span className='text-foreground/80 font-medium'>
                        {item.contentTypeName || '—'}
                      </span>
                    </td>
                    <td className='px-4 py-6 text-center'>
                      <span className='text-muted-foreground'>{release}</span>
                    </td>
                    <td className='px-4 py-6'>
                      <div className='flex flex-wrap gap-2'>
                        {(item.genreNames && item.genreNames.length > 0 ? item.genreNames : ['—']).map((g, idx) => (
                          <span key={idx} className='px-2 py-0.5 border border-border rounded-full text-[10px] text-primary uppercase font-semibold'>
                            {g}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className='px-4 py-6 text-right'>
                      <div className='flex items-center justify-end space-x-3'>
                        <button
                          onClick={() => router.push(`/submissions/${item._id}/edit`)}
                          className='text-primary hover:text-foreground transition-colors text-[10px] font-bold tracking-widest'
                        >
                          EDIT
                        </button>
                        <button
                          onClick={() => router.push(`/submissions/${item._id}/crew`)}
                          className='text-primary hover:text-foreground transition-colors text-[10px] font-bold tracking-widest'
                        >
                          MANAGE CREW
                        </button>
                        <button
                          onClick={() => router.push(`/submissions/${item._id}/nomination`)}
                          className='text-primary hover:text-foreground transition-colors text-[10px] font-bold tracking-widest'
                        >
                          NOMINATE
                        </button>
                        <button className='text-red-500 hover:text-red-400 transition-colors text-[10px] font-bold tracking-widest'>DELETE</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Footer / pagination summary */}
      <div className='mt-8 flex items-center justify-between border-t border-border pt-6'>
        <span className='text-xs text-muted-foreground tracking-wider'>
          {`SHOWING ${showingStart}-${showingEnd} OF ${total} SUBMISSIONS`}
        </span>
        <div className='flex space-x-2'>
          <button className='w-8 h-8 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-primary transition-colors'>‹</button>
          <button className='w-8 h-8 rounded bg-primary text-black font-bold text-xs'>1</button>
          <button className='w-8 h-8 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-primary transition-colors text-xs font-bold'>2</button>
          <button className='w-8 h-8 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-primary transition-colors text-xs font-bold'>3</button>
          <button className='w-8 h-8 rounded border border-border flex items-center justify-center text-muted-foreground hover:text-primary transition-colors'>›</button>
        </div>
      </div>
    </main>
  );
}
