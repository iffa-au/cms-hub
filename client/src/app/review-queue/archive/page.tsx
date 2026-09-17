'use client';

import { useCallback, useEffect, useState } from 'react';
import { getData, patchData } from '@/lib/fetch-util';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PageShell from '@/components/page-shell';
import Pagination from '@/components/pagination';
import RecordList, { type Column } from '@/components/record-list';
import ConfirmDialog from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';

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

export default function ArchivePage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageMeta, setPageMeta] = useState<{ page: number; limit: number; total: number } | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [restoringTitle, setRestoringTitle] = useState<string | null>(null);

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

  const load = useCallback(async (q: string, page: number) => {
    try {
      setLoading(true);
      setError(null);
      const safePage = Math.max(page, 1);
      const safeQuery = q.trim();
      const parts = [`page=${safePage}`, `limit=${PAGE_LIMIT}`, `status=REJECTED`];
      if (safeQuery) parts.push(`q=${encodeURIComponent(safeQuery)}`);
      const res = await getData<ListResponse>(`/submissions?${parts.join('&')}`);
      setItems(res?.data ?? []);
      const meta = res?.meta ?? { page: safePage, limit: PAGE_LIMIT, total: res?.data?.length ?? 0 };
      setPageMeta(meta);
      setCurrentPage(meta.page);
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to load submissions'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load('', 1);
  }, [load]);

  const activePage = pageMeta?.page ?? currentPage;
  const activeLimit = pageMeta?.limit ?? PAGE_LIMIT;
  const total = pageMeta?.total ?? items.length;
  const totalPages = Math.max(1, Math.ceil(total / activeLimit));
  const showingStart = items.length === 0 ? 0 : (activePage - 1) * activeLimit + 1;
  const showingEnd = items.length === 0 ? 0 : showingStart + items.length - 1;
  const goToPage = (targetPage: number) => {
    if (loading || targetPage === activePage || targetPage < 1 || targetPage > totalPages) return;
    setCurrentPage(targetPage);
    void load(query, targetPage);
  };

  const restore = async (id: string) => {
    try {
      await patchData(`/submissions/${id}/restore`, {});
      await load(query, activePage);
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to restore submission'));
    }
  };

  const columns: Column<Submission>[] = [
    {
      key: 'title',
      header: 'Film',
      role: 'title',
      cell: (item) => (
        <div className="min-w-0">
          <h3 className="truncate font-serif text-lg text-foreground">{item.title}</h3>
          <p className="line-clamp-1 max-w-md text-xs text-muted-foreground">
            {item.synopsis || '\u2014'}
          </p>
        </div>
      ),
    },
    {
      key: 'contentType',
      header: 'Type',
      cell: (item) => (
        <span className="text-foreground/80">{item.contentTypeName || '\u2014'}</span>
      ),
    },
    {
      key: 'release',
      header: 'Release',
      align: 'center',
      cell: (item) => (
        <span className="font-mono text-xs text-muted-foreground">
          {item.releaseDate ? new Date(item.releaseDate).getFullYear() : '\u2014'}
        </span>
      ),
    },
    {
      key: 'submitted',
      header: 'Submitted',
      cell: (item) => (
        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          {formatSubmittedAt(item.createdAt)}
        </span>
      ),
    },
    {
      key: 'genres',
      header: 'Genres',
      showFrom: 'xl',
      cell: (item) => (
        <div className="flex flex-wrap gap-1.5">
          {(item.genreNames && item.genreNames.length > 0
            ? item.genreNames
            : ['\u2014']
          ).map((g, idx) => (
            <span
              key={idx}
              className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground"
            >
              {g}
            </span>
          ))}
        </div>
      ),
    },
  ];

  return (
    <PageShell
      title="Archive"
      description="Submissions that were rejected. Restoring one returns it to the review queue."
      actions={
        <Button variant="outline" asChild>
          <Link href="/review-queue">Back to review queue</Link>
        </Button>
      }
    >
      <div className="mb-6 flex flex-col gap-2 rounded-lg border border-border bg-card p-2 sm:flex-row sm:items-center">
        <label htmlFor="archive-search" className="sr-only">
          Search the archive by title
        </label>
        <input
          id="archive-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setCurrentPage(1);
              void load(query, 1);
            }
          }}
          className="w-full grow rounded bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          placeholder="Search by title"
          type="search"
        />
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border pt-2 sm:border-l sm:border-t-0 sm:pl-2 sm:pt-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery('');
              setCurrentPage(1);
              void load('', 1);
            }}
          >
            Clear
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setCurrentPage(1);
              void load(query, 1);
            }}
          >
            Search
          </Button>
        </div>
      </div>

      <RecordList
        items={items}
        columns={columns}
        getKey={(item) => item._id}
        getStatus={() => 'REJECTED'}
        loading={loading}
        error={error}
        empty="Nothing has been rejected."
        actions={(item) => (
          <>
            <Button
              variant="rowAction"
              size="inline"
              onClick={() => router.push(`/submissions/${item._id}/view?from=archive`)}
            >
              View
            </Button>
            <Button
              variant="rowPositive"
              size="inline"
              onClick={() => {
                setRestoringId(item._id);
                setRestoringTitle(item.title);
              }}
            >
              Restore
            </Button>
          </>
        )}
      />

      <Pagination
        page={activePage}
        totalPages={totalPages}
        onPage={goToPage}
        disabled={loading}
        summary={`Showing ${showingStart}\u2013${showingEnd} of ${total} submissions`}
      />

      <ConfirmDialog
        open={restoringId !== null}
        title="Restore this submission?"
        description={
          <>
            <span className="text-foreground">{restoringTitle}</span> goes back to
            the review queue and can be approved or rejected again.
          </>
        }
        confirmLabel="Restore"
        onCancel={() => {
          setRestoringId(null);
          setRestoringTitle(null);
        }}
        onConfirm={() => {
          const id = restoringId;
          setRestoringId(null);
          setRestoringTitle(null);
          if (id) void restore(id);
        }}
      />
    </PageShell>
  );
}
