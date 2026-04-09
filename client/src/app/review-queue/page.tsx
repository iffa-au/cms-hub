'use client';

import { useCallback, useEffect, useState } from 'react';
import { getData, patchData } from '@/lib/fetch-util';
import { useRouter } from 'next/navigation';
import DownloadPdfButton from '@/components/review-queue/download-pdf-button';

type Submission = {
  _id: string;
  title: string;
  synopsis?: string;
  releaseDate?: string;
  createdAt?: string;
  contentTypeName?: string | null;
  genreNames?: string[];
};

type ListResponse = {
  success: boolean;
  data: Submission[];
  meta?: { page: number; limit: number; total: number };
  message?: string;
};

const PAGE_LIMIT = 20;

export default function ReviewQueuePage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pageMeta, setPageMeta] = useState<{ page: number; limit: number; total: number } | null>(null);

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

  const load = useCallback(async (q?: string) => {
    try {
      setLoading(true);
      setError(null);
      const safePage = Math.max(page, 1);
      const safeQuery = q.trim();
      const parts = [`page=${safePage}`, `limit=${PAGE_LIMIT}`, `status=SUBMITTED`];
      if (safeQuery) parts.push(`q=${encodeURIComponent(safeQuery)}`);
      const res = await getData<ListResponse>(`/submissions?${parts.join('&')}`);
      setItems(res?.data ?? []);
      setPageMeta(res?.meta ?? null);
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to load submissions'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void load('', 1);
  }, [load]);

  const activePage = pageMeta?.page ?? currentPage;
  const activeLimit = pageMeta?.limit ?? PAGE_LIMIT;
  const total = pageMeta?.total ?? items.length;
  const totalPages = Math.max(1, Math.ceil(total / activeLimit));
  const showingStart = items.length === 0 ? 0 : (activePage - 1) * activeLimit + 1;
  const showingEnd = items.length === 0 ? 0 : showingStart + items.length - 1;
  const pageStart = Math.max(1, activePage - 2);
  const pageEnd = Math.min(totalPages, activePage + 2);
  const visiblePages = Array.from({ length: pageEnd - pageStart + 1 }, (_, idx) => pageStart + idx);

  const goToPage = (targetPage: number) => {
    if (loading || targetPage === activePage || targetPage < 1 || targetPage > totalPages) return;
    setCurrentPage(targetPage);
    void load(query, targetPage);
  };

  const approve = async (id: string) => {
    try {
      await patchData(`/submissions/${id}/approve`, {});
      await load(query, activePage);
    } catch {
      // ignore for now
    }
  };
  const reject = async (id: string) => {
    try {
      await patchData(`/submissions/${id}/reject`, {});
      await load(query, activePage);
    } catch {
      // ignore for now
    }
  };

  return (
    <main className='flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full'>
      <div className='flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4'>
        <div>
          <h1 className='font-serif text-3xl md:text-4xl text-white mb-2'>Review Queue</h1>
          <p className='text-accent-foreground text-sm'>Pending submissions awaiting review.</p>
        </div>
        <DownloadAllPdfButton query={query} onError={setActionError} />
      </div>
      {actionError && <p className='text-red-400 text-sm mb-4'>{actionError}</p>}

      {/* Search bar */}
      <div className='bg-card p-2 rounded border border-border mb-8 flex items-center gap-2'>
        <div className='relative grow'>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setCurrentPage(1);
                void load(query, 1);
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
            setCurrentPage(1);
            void load('', 1);
          }}
          className='px-4 py-2 text-muted-foreground hover:text-primary transition-colors border-l border-border text-xs font-semibold tracking-widest'
        >
          CLEAR
        </button>
        <button
          onClick={() => {
            setCurrentPage(1);
            void load(query, 1);
          }}
          className='bg-foreground text-background px-6 py-2.5 rounded text-xs font-bold tracking-widest hover:opacity-90 transition-opacity'
        >
          SEARCH
        </button>
      </div>

      <div className='overflow-x-auto'>
        <table className='w-full text-left border-separate border-spacing-y-2'>
          <thead>
            <tr className='text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold'>
              <th className='px-4 py-3 text-center'>No.</th>
              <th className='px-4 py-3'>Film Details</th>
              <th className='px-4 py-3'>Content Type</th>
              <th className='px-4 py-3 text-center'>Release Year</th>
              <th className='px-4 py-3'>Genres</th>
              <th className='px-4 py-3 text-right'>Actions</th>
            </tr>
          </thead>
          <tbody className='text-sm'>
            {loading && (
              <tr className='bg-card/60'>
                <td className='px-4 py-6' colSpan={6}>
                  <div className='animate-pulse h-4 w-1/3 bg-border rounded mb-3' />
                  <div className='animate-pulse h-3 w-2/3 bg-border rounded' />
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr className='bg-card/60'>
                <td className='px-4 py-6' colSpan={6}>
                  <span className='text-red-400 text-sm'>{error}</span>
                </td>
              </tr>
            )}
            {!loading && !error && items.length === 0 && (
              <tr className='bg-card/60'>
                <td className='px-4 py-6' colSpan={6}>
                  <span className='text-muted-foreground text-sm'>No submissions found.</span>
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              items.map((item, idx) => {
                const release = item.releaseDate ? new Date(item.releaseDate).getFullYear().toString() : '—';
                return (
                  <tr key={item._id} className='bg-card/60'>
                    <td className='px-4 py-6 text-center text-muted-foreground font-semibold'>{showingStart + idx}</td>
                    <td className='px-4 py-6 border-l-2 border-primary'>
                      <h3 className='font-serif text-primary font-bold text-lg mb-1'>{item.title}</h3>
                      {item.synopsis ? (
                        <p className='text-muted-foreground text-xs line-clamp-1 max-w-md'>{item.synopsis}</p>
                      ) : (
                        <p className='text-muted-foreground text-xs line-clamp-1 max-w-md'>—</p>
                      )}
                    </td>
                    <td className='px-4 py-6'>
                      <span className='text-foreground/80 font-medium'>{item.contentTypeName || '—'}</span>
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
                          onClick={() => router.push(`/submissions/${item._id}/edit?from=review-queue`)}
                          className='text-primary hover:text-foreground transition-colors text-[10px] font-bold tracking-widest'
                        >
                          DETAIL
                        </button>
                        <button
                          onClick={() => void approve(item._id)}
                          className='text-green-500 hover:text-green-400 transition-colors text-[10px] font-bold tracking-widest'
                        >
                          APPROVE
                        </button>
                        <button
                          onClick={() => void reject(item._id)}
                          className='text-red-500 hover:text-red-400 transition-colors text-[10px] font-bold tracking-widest'
                        >
                          REJECT
                        </button>
                        <DownloadPdfButton submissionId={item._id} onError={setActionError} />
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className='mt-8 flex items-center justify-between border-t border-border pt-6'>
        <span className='text-xs text-muted-foreground tracking-wider'>
          {`SHOWING ${showingStart}-${showingEnd} OF ${total} SUBMISSIONS`}
        </span>
        <div className='flex items-center gap-2'>
          {pageStart > 1 && (
            <>
              <button
                onClick={() => goToPage(1)}
                disabled={loading}
                className='h-8 min-w-8 px-2 rounded border border-border text-xs font-semibold text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary transition-colors'
              >
                1
              </button>
              <span className='text-muted-foreground text-xs px-1'>...</span>
            </>
          )}
          {visiblePages.map((pageNum) => (
            <button
              key={pageNum}
              onClick={() => goToPage(pageNum)}
              disabled={loading}
              className={`h-8 min-w-8 px-2 rounded border text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                pageNum === activePage
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border text-foreground hover:border-primary'
              }`}
            >
              {pageNum}
            </button>
          ))}
          {pageEnd < totalPages && (
            <>
              <span className='text-muted-foreground text-xs px-1'>...</span>
              <button
                onClick={() => goToPage(totalPages)}
                disabled={loading}
                className='h-8 min-w-8 px-2 rounded border border-border text-xs font-semibold text-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:border-primary transition-colors'
              >
                {totalPages}
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

