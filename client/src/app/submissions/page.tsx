'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getData } from '@/lib/fetch-util';
import PageShell from '@/components/page-shell';
import Pagination from '@/components/pagination';
import RecordList, { type Column } from '@/components/record-list';
import { StatusChip, type RecordStatus } from '@/components/status';
import { Button } from '@/components/ui/button';
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
  contentTypeId?: string;
  genreIds?: string[];
  contentTypeName?: string | null;
  countryName?: string | null;
  genreNames?: string[];
  status?: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
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
  message?: string;
  data: Submission[];
  meta?: { page: number; limit: number; total: number };
};

type StatusFilter = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ALL';

type LoadOverrides = {
  q?: string;
  status?: StatusFilter;
  filters?: AdvancedFilters;
  page?: number;
};

export default function SubmissionsPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('APPROVED');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<AdvancedFilters>(EMPTY_FILTERS);
  const filterOptions = useFilterOptions();

  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageMeta, setPageMeta] = useState<{ page: number; limit: number; total: number } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const activeFiltersCount = countActiveFilters(filters);

  async function load(overrides: LoadOverrides = {}) {
    try {
      setLoading(true);
      setError(null);
      const page = overrides.page ?? 1;
      const parts = [`page=${page}`, `limit=20`];
      const s = overrides.status ?? statusFilter;
      const q = overrides.q ?? query;
      if (s && s !== 'ALL') parts.push(`status=${encodeURIComponent(s)}`);
      if (q && q.trim()) parts.push(`q=${encodeURIComponent(q.trim())}`);
      appendFilterParams(parts, overrides.filters ?? filters);
      const res = await getData<ListResponse>(`/submissions?${parts.join('&')}`);
      setItems(res?.data ?? []);
      setPageMeta(res?.meta ?? null);
      setCurrentPage(page);
    } catch (e: any) {
      setError(e?.message || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load({ q: '', status: statusFilter });
  }, []);

  const showingStart = items.length === 0 ? 0 : (currentPage - 1) * 20 + 1;
  const showingEnd = items.length === 0 ? 0 : (currentPage - 1) * 20 + items.length;
  const total = pageMeta?.total ?? items.length;
  const totalPages = pageMeta ? Math.ceil(pageMeta.total / pageMeta.limit) : 1;

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
      key: 'status',
      header: 'Status',
      role: 'cardHidden',
      cell: (item) =>
        item.status ? (
          <StatusChip status={item.status as RecordStatus} />
        ) : (
          <span className="text-muted-foreground">—</span>
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
      title="Content library"
      description="Feature films, shorts, series and historical archives."
    >
      {/* Search and primary filters. Wraps to its own rows below `sm` — as a
          single non-wrapping flex row this pushed the search field to nothing
          on a phone. */}
      <div className="mb-6 flex flex-col gap-2 rounded-lg border border-border bg-card p-2 sm:flex-row sm:items-center">
        <label htmlFor="submissions-search" className="sr-only">
          Search submissions by title
        </label>
        <input
          id="submissions-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void load();
          }}
          className="w-full grow rounded bg-transparent px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          placeholder="Search by title"
          type="search"
        />

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border pt-2 sm:border-l sm:border-t-0 sm:pl-2 sm:pt-0">
          <label htmlFor="status-filter" className="text-xs text-muted-foreground">
            Status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={(e) => {
              const val = e.target.value as StatusFilter;
              setStatusFilter(val);
              void load({ status: val });
            }}
            className="rounded border border-border bg-transparent px-2 py-2 text-sm text-foreground"
          >
            <option value="ALL">All</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

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
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery('');
              void load({ q: '' });
            }}
          >
            Clear
          </Button>
          <Button type="button" size="sm" onClick={() => void load()}>
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
        onApply={() => void load()}
        onClearAll={() => {
          setQuery('');
          setStatusFilter('ALL');
          setFilters(EMPTY_FILTERS);
          void load({ q: '', status: 'ALL', filters: EMPTY_FILTERS });
        }}
      />

      <RecordList
        items={items}
        columns={columns}
        getKey={(item) => item._id}
        getStatus={(item) => item.status as RecordStatus | undefined}
        loading={loading}
        error={error}
        empty="No submissions match these filters."
        actions={(item) => (
          <Button
            variant="rowAction"
            size="inline"
            onClick={() => router.push(`/submissions/${item._id}/view?from=submissions`)}
          >
            View
          </Button>
        )}
      />

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        onPage={(p) => void load({ page: p })}
        disabled={loading}
        summary={`Showing ${showingStart}–${showingEnd} of ${total} submissions`}
      />
    </PageShell>
  );
}
