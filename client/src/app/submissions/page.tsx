'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getData, deleteData, patchData } from '@/lib/fetch-util';
import PageShell from '@/components/page-shell';
import ConfirmDialog from '@/components/confirm-dialog';
import Pagination from '@/components/pagination';
import RecordList, { type Column } from '@/components/record-list';
import { StatusChip, type RecordStatus } from '@/components/status';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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

type FilterOption = { _id: string; name: string };
type OptionsResponse = { success: boolean; data: FilterOption[] };
type StatusFilter = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'ALL';

type LoadOverrides = {
  q?: string;
  status?: StatusFilter;
  contentTypeIds?: string[];
  genreIds?: string[];
  countryId?: string;
  languageId?: string;
  year?: string;
  page?: number;
};

export default function SubmissionsPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('APPROVED');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [selectedContentTypeIds, setSelectedContentTypeIds] = useState<string[]>([]);
  const [selectedGenreIds, setSelectedGenreIds] = useState<string[]>([]);
  const [selectedCountryId, setSelectedCountryId] = useState('');
  const [selectedLanguageId, setSelectedLanguageId] = useState('');
  const [selectedYear, setSelectedYear] = useState('');

  const [contentTypes, setContentTypes] = useState<FilterOption[]>([]);
  const [genres, setGenres] = useState<FilterOption[]>([]);
  const [countries, setCountries] = useState<FilterOption[]>([]);
  const [languages, setLanguages] = useState<FilterOption[]>([]);
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageMeta, setPageMeta] = useState<{ page: number; limit: number; total: number } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<Submission | null>(null);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 40 }, (_, i) => String(currentYear - i));
  }, []);
  const activeFiltersCount = useMemo(() => {
    return (
      selectedContentTypeIds.length +
      selectedGenreIds.length +
      (selectedCountryId ? 1 : 0) +
      (selectedLanguageId ? 1 : 0) +
      (selectedYear ? 1 : 0)
    );
  }, [
    selectedContentTypeIds.length,
    selectedGenreIds.length,
    selectedCountryId,
    selectedLanguageId,
    selectedYear,
  ]);

  const toggleMulti = (
    value: string,
    values: string[],
    setter: (next: string[]) => void,
  ) => {
    if (!value) return;
    if (values.includes(value)) {
      setter(values.filter((v) => v !== value));
      return;
    }
    setter([...values, value]);
  };

  async function load(overrides: LoadOverrides = {}) {
    try {
      setLoading(true);
      setError(null);
      const page = overrides.page ?? 1;
      const parts = [`page=${page}`, `limit=20`];
      const s = overrides.status ?? statusFilter;
      const q = overrides.q ?? query;
      const contentTypeIds = overrides.contentTypeIds ?? selectedContentTypeIds;
      const genreIds = overrides.genreIds ?? selectedGenreIds;
      const countryId = overrides.countryId ?? selectedCountryId;
      const languageId = overrides.languageId ?? selectedLanguageId;
      const year = overrides.year ?? selectedYear;
      if (s && s !== 'ALL') parts.push(`status=${encodeURIComponent(s)}`);
      if (q && q.trim()) parts.push(`q=${encodeURIComponent(q.trim())}`);
      if (contentTypeIds.length > 0) {
        parts.push(`contentTypeIds=${encodeURIComponent(contentTypeIds.join(','))}`);
      }
      if (genreIds.length > 0) {
        parts.push(`genreIds=${encodeURIComponent(genreIds.join(','))}`);
      }
      if (countryId) parts.push(`countryId=${encodeURIComponent(countryId)}`);
      if (languageId) parts.push(`languageId=${encodeURIComponent(languageId)}`);
      if (year) parts.push(`year=${encodeURIComponent(year)}`);
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
    let mounted = true;
    (async () => {
      if (!mounted) return;
      try {
        const [countriesRes, languagesRes, genresRes, contentTypesRes] = await Promise.all([
          getData<OptionsResponse>('/countries'),
          getData<OptionsResponse>('/languages'),
          getData<OptionsResponse>('/genres'),
          getData<OptionsResponse>('/content-types'),
        ]);
        if (!mounted) return;
        setCountries(countriesRes?.data ?? []);
        setLanguages(languagesRes?.data ?? []);
        setGenres(genresRes?.data ?? []);
        setContentTypes(contentTypesRes?.data ?? []);
      } catch {
        if (!mounted) return;
        setCountries([]);
        setLanguages([]);
        setGenres([]);
        setContentTypes([]);
      }
      await load({ q: '', status: statusFilter });
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const showingStart = items.length === 0 ? 0 : (currentPage - 1) * 20 + 1;
  const showingEnd = items.length === 0 ? 0 : (currentPage - 1) * 20 + items.length;
  const total = pageMeta?.total ?? items.length;
  const totalPages = pageMeta ? Math.ceil(pageMeta.total / pageMeta.limit) : 1;

  async function remove(id: string) {
    if (!id) return;
    try {
      await deleteData(`/submissions/${id}`);
      toast.success('Submission deleted');
      await load({ page: currentPage });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete submission');
    }
  }

  async function approve(id: string) {
    try {
      await patchData(`/submissions/${id}/approve`, {});
      toast.success('Submission approved');
      await load({ page: currentPage });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to approve submission');
    }
  }

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
      actions={
        <Button asChild>
          <Link href="/submissions/new">Add content</Link>
        </Button>
      }
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

      {/* Advanced filters */}
      {isFiltersOpen ? (
        <div
          className="fixed inset-0 z-50 overflow-y-auto bg-black/45 px-4 py-8 backdrop-blur-sm"
          onClick={() => setIsFiltersOpen(false)}
        >
          <div
            id="advanced-filters-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Advanced filters"
            className="mx-auto max-w-3xl space-y-5 rounded-lg border border-border bg-surface-overlay p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold">Advanced filters</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQuery('');
                  setStatusFilter('ALL');
                  setSelectedContentTypeIds([]);
                  setSelectedGenreIds([]);
                  setSelectedCountryId('');
                  setSelectedLanguageId('');
                  setSelectedYear('');
                  void load({
                    q: '',
                    status: 'ALL',
                    contentTypeIds: [],
                    genreIds: [],
                    countryId: '',
                    languageId: '',
                    year: '',
                  });
                }}
              >
                Clear all
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="filter-country" className="text-xs text-muted-foreground">
                  Country
                </label>
                <select
                  id="filter-country"
                  value={selectedCountryId}
                  onChange={(e) => setSelectedCountryId(e.target.value)}
                  className="rounded border border-border bg-transparent px-2 py-2 text-sm text-foreground"
                >
                  <option value="">All countries</option>
                  {countries.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="filter-language" className="text-xs text-muted-foreground">
                  Language
                </label>
                <select
                  id="filter-language"
                  value={selectedLanguageId}
                  onChange={(e) => setSelectedLanguageId(e.target.value)}
                  className="rounded border border-border bg-transparent px-2 py-2 text-sm text-foreground"
                >
                  <option value="">All languages</option>
                  {languages.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="filter-year" className="text-xs text-muted-foreground">
                  Year
                </label>
                <select
                  id="filter-year"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="rounded border border-border bg-transparent px-2 py-2 text-sm text-foreground"
                >
                  <option value="">All years</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-xs text-muted-foreground">Categories</legend>
              <div className="flex flex-wrap gap-2">
                {contentTypes.map((item) => {
                  const selected = selectedContentTypeIds.includes(item._id);
                  return (
                    <button
                      key={item._id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        toggleMulti(item._id, selectedContentTypeIds, setSelectedContentTypeIds)
                      }
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:text-primary'
                      }`}
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-xs text-muted-foreground">Genres</legend>
              <div className="flex flex-wrap gap-2">
                {genres.map((item) => {
                  const selected = selectedGenreIds.includes(item._id);
                  return (
                    <button
                      key={item._id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleMulti(item._id, selectedGenreIds, setSelectedGenreIds)}
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                        selected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:text-primary'
                      }`}
                    >
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsFiltersOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  void load();
                  setIsFiltersOpen(false);
                }}
              >
                Apply filters
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <RecordList
        items={items}
        columns={columns}
        getKey={(item) => item._id}
        getStatus={(item) => item.status as RecordStatus | undefined}
        loading={loading}
        error={error}
        empty="No submissions match these filters."
        actions={(item) => (
          <>
            <Button
              variant="rowAction"
              size="inline"
              onClick={() => router.push(`/submissions/${item._id}/edit`)}
            >
              Edit
            </Button>
            <Button
              variant="rowAction"
              size="inline"
              onClick={() => router.push(`/submissions/${item._id}/crew`)}
            >
              Crew
            </Button>
            <Button
              variant="rowAction"
              size="inline"
              onClick={() => router.push(`/submissions/${item._id}/nomination`)}
            >
              Nominate
            </Button>
            {item.status === 'REJECTED' ? (
              <Button
                variant="rowPositive"
                size="inline"
                onClick={() => void approve(item._id)}
              >
                Approve
              </Button>
            ) : null}
            <Button
              variant="rowDanger"
              size="inline"
              onClick={() => setPendingDelete(item)}
            >
              Delete
            </Button>
          </>
        )}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        tone="danger"
        title="Delete this submission?"
        description={
          <>
            <span className="text-foreground">{pendingDelete?.title}</span> and its
            uploaded assets will be removed. This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete submission"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const id = pendingDelete?._id;
          setPendingDelete(null);
          if (id) void remove(id);
        }}
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
