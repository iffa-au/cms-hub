'use client';

import { useCallback, useEffect, useState } from 'react';
import { getData, patchData } from '@/lib/fetch-util';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DownloadAllPdfButton from '@/components/review-queue/download-all-pdf-button';
import PageShell from '@/components/page-shell';
import Pagination from '@/components/pagination';
import RecordList, { type Column } from '@/components/record-list';
import ConfirmDialog from '@/components/confirm-dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  AdvancedFiltersDialog,
  EMPTY_FILTERS,
  appendFilterParams,
  countActiveFilters,
  useFilterOptions,
  type AdvancedFilters,
} from '@/components/submissions/advanced-filters';

type Submission = {
  _id: string;
  title: string;
  synopsis?: string;
  releaseDate?: string;
  durationHours?: number;
  durationMinutes?: number;
  createdAt?: string;
  contentTypeName?: string | null;
  countryName?: string | null;
  genreNames?: string[];
};

const formatDuration = (hours?: number, minutes?: number): string => {
  if (!hours && !minutes) return '—';
  const parts = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  return parts.join(' ');
};

type ListResponse = {
  success: boolean;
  data: Submission[];
  meta?: { page: number; limit: number; total: number };
  message?: string;
};

const PAGE_LIMIT = 20;

type BulkAction = 'APPROVED' | 'REJECTED' | 'ARCHIVED';

type BulkResponse = {
  success: boolean;
  data?: { updated: number; skipped: number };
  message?: string;
};

const BULK_COPY: Record<
  BulkAction,
  { verb: string; done: string; tone: 'default' | 'danger'; note: string }
> = {
  APPROVED: {
    verb: 'Approve',
    done: 'approved',
    tone: 'default',
    note: 'They will appear on the public site.',
  },
  REJECTED: {
    verb: 'Reject',
    done: 'rejected',
    tone: 'danger',
    note: 'They move to the Archive page, where they can be restored.',
  },
  ARCHIVED: {
    verb: 'Archive',
    done: 'archived',
    tone: 'default',
    note: 'Use this for duplicates. They move to the Archive page without being rejected, and can be restored.',
  },
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

export default function ReviewQueuePage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<AdvancedFilters>(EMPTY_FILTERS);
  const filterOptions = useFilterOptions();
  const activeFiltersCount = countActiveFilters(filters);
  const [currentPage, setCurrentPage] = useState(1);
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pageMeta, setPageMeta] = useState<{ page: number; limit: number; total: number } | null>(null);
  // Page-scoped: cleared on every load, so a selection can never include a
  // film that is no longer on screen.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingBulk, setPendingBulk] = useState<BulkAction | null>(null);
  const [isBulkBusy, setIsBulkBusy] = useState(false);

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

  const load = useCallback(async (q: string, f: AdvancedFilters, page: number) => {
    try {
      setLoading(true);
      setError(null);
      setSelected(new Set());
      const safePage = Math.max(page, 1);
      const safeQuery = q.trim();
      const parts = [`page=${safePage}`, `limit=${PAGE_LIMIT}`, `status=SUBMITTED`];
      if (safeQuery) parts.push(`q=${encodeURIComponent(safeQuery)}`);
      appendFilterParams(parts, f);
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
    void load('', EMPTY_FILTERS, 1);
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
    void load(query, filters, targetPage);
  };

  const selectedTitles = items.filter((item) => selected.has(item._id)).map((item) => item.title);

  const runBulk = async (action: BulkAction) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    try {
      setIsBulkBusy(true);
      setActionError(null);
      const res = await patchData<BulkResponse>('/submissions/bulk-status', { ids, status: action });
      const updated = res?.data?.updated ?? 0;
      const skipped = res?.data?.skipped ?? 0;
      toast.success(
        `${updated} film${updated === 1 ? '' : 's'} ${BULK_COPY[action].done}` +
          (skipped > 0 ? ` · ${skipped} already decided elsewhere, left unchanged` : ''),
      );
      setPendingBulk(null);
      // Emptying the last page would otherwise land on a blank one.
      const nextPage = ids.length >= items.length && activePage > 1 ? activePage - 1 : activePage;
      await load(query, filters, nextPage);
    } catch (e: unknown) {
      setActionError(getErrorMessage(e, `Failed to ${BULK_COPY[action].verb.toLowerCase()} submissions`));
      setPendingBulk(null);
    } finally {
      setIsBulkBusy(false);
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
            {item.synopsis || '—'}
          </p>
        </div>
      ),
    },
    {
      key: 'contentType',
      header: 'Type',
      cell: (item) => (
        <span className="text-foreground/80">{item.contentTypeName || '—'}</span>
      ),
    },
    {
      key: 'country',
      header: 'Country',
      cell: (item) => (
        <span className="text-foreground/80">{item.countryName || '—'}</span>
      ),
    },
    {
      key: 'release',
      header: 'Release',
      align: 'center',
      cell: (item) => (
        <span className="font-mono text-xs text-muted-foreground">
          {item.releaseDate ? new Date(item.releaseDate).getFullYear() : '—'}
        </span>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      align: 'center',
      showFrom: 'xl',
      cell: (item) => (
        <span className="font-mono text-xs text-muted-foreground">
          {formatDuration(item.durationHours, item.durationMinutes)}
        </span>
      ),
    },
    {
      key: 'submitted',
      header: 'Submitted',
      cell: (item) => (
        <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
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
            : ['—']
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
      title="Review queue"
      description="Submissions awaiting a decision."
      actions={
        <>
          <Button variant="outline" asChild>
            <Link href="/review-queue/archive">Archive</Link>
          </Button>
          <DownloadAllPdfButton query={query} filters={filters} onError={setActionError} />
        </>
      }
    >
      {actionError && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-status-rejected/35 bg-status-rejected/10 px-4 py-3 text-sm text-status-rejected"
        >
          {actionError}
        </p>
      )}

      <div className="mb-6 flex flex-col gap-2 rounded-lg border border-border bg-card p-2 sm:flex-row sm:items-center">
        <label htmlFor="review-search" className="sr-only">
          Search the review queue by title
        </label>
        <input
          id="review-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setCurrentPage(1);
              void load(query, filters, 1);
            }
          }}
          className="w-full grow rounded bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          placeholder="Search by title"
          type="search"
        />
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border pt-2 sm:border-l sm:border-t-0 sm:pl-2 sm:pt-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={isFiltersOpen}
            aria-controls="advanced-filters-panel"
            onClick={() => setIsFiltersOpen((open) => !open)}
          >
            {`Filters${activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}`}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery('');
              setCurrentPage(1);
              void load('', filters, 1);
            }}
          >
            Clear
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setCurrentPage(1);
              void load(query, filters, 1);
            }}
          >
            Search
          </Button>
        </div>
      </div>

      <AdvancedFiltersDialog
        open={isFiltersOpen}
        onClose={() => setIsFiltersOpen(false)}
        options={filterOptions}
        value={filters}
        onChange={setFilters}
        onApply={() => {
          setCurrentPage(1);
          void load(query, filters, 1);
        }}
        onClearAll={() => {
          setQuery('');
          setFilters(EMPTY_FILTERS);
          setCurrentPage(1);
          void load('', EMPTY_FILTERS, 1);
        }}
      />

      {selected.size > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="sticky top-[calc(var(--header-h)+0.5rem)] z-20 mb-4 flex flex-col gap-2 rounded-lg border border-border-strong bg-surface-overlay p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-foreground" aria-live="polite">
            {selected.size} selected
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setPendingBulk('APPROVED')} disabled={isBulkBusy}>
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPendingBulk('REJECTED')} disabled={isBulkBusy}>
              Reject
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPendingBulk('ARCHIVED')} disabled={isBulkBusy}>
              Archive
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={isBulkBusy}>
              Clear selection
            </Button>
          </div>
        </div>
      )}

      <RecordList
        selection={{
          selected,
          onChange: setSelected,
          label: (key) => `Select ${items.find((item) => item._id === key)?.title ?? 'film'}`,
        }}
        items={items}
        columns={columns}
        getKey={(item) => item._id}
        getStatus={() => 'SUBMITTED'}
        loading={loading}
        error={error}
        empty="Nothing is waiting for review."
        actions={(item) => (
          <Button
            variant="rowAction"
            size="inline"
            onClick={() => router.push(`/submissions/${item._id}/view?from=review-queue`)}
          >
            Review
          </Button>
        )}
      />

      <ConfirmDialog
        open={pendingBulk !== null}
        title={
          pendingBulk
            ? `${BULK_COPY[pendingBulk].verb} ${selected.size} film${selected.size === 1 ? '' : 's'}?`
            : ''
        }
        description={
          pendingBulk && (
            <>
              <p>{BULK_COPY[pendingBulk].note}</p>
              <ul className="mt-3 max-h-40 list-disc space-y-0.5 overflow-y-auto pl-5 text-foreground/80">
                {selectedTitles.map((title, idx) => (
                  <li key={idx}>{title}</li>
                ))}
              </ul>
            </>
          )
        }
        confirmLabel={pendingBulk ? BULK_COPY[pendingBulk].verb : 'Confirm'}
        tone={pendingBulk ? BULK_COPY[pendingBulk].tone : 'default'}
        busy={isBulkBusy}
        onConfirm={() => pendingBulk && void runBulk(pendingBulk)}
        onCancel={() => {
          if (!isBulkBusy) setPendingBulk(null);
        }}
      />

      <Pagination
        page={activePage}
        totalPages={totalPages}
        onPage={goToPage}
        disabled={loading}
        summary={`Showing ${showingStart}–${showingEnd} of ${total} submissions`}
      />
    </PageShell>
  );
}
