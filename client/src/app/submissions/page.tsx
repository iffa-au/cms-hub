'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getData, deleteData, patchData } from '@/lib/fetch-util';

type Submission = {
  _id: string;
  title: string;
  synopsis?: string;
  releaseDate?: string;
  contentTypeId?: string;
  genreIds?: string[];
  contentTypeName?: string | null;
  genreNames?: string[];
  status?: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
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
      const parts = [`page=1`, `limit=20`];
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

  const showingStart = items.length === 0 ? 0 : 1;
  const showingEnd = items.length;
  const total = pageMeta?.total ?? items.length;

  async function remove(id: string) {
    if (!id) return;
    const ok = typeof window !== 'undefined' ? window.confirm('Delete this submission? This cannot be undone.') : true;
    if (!ok) return;
    try {
      await deleteData(`/submissions/${id}`);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to delete submission');
    }
  }

  async function approve(id: string) {
    try {
      await patchData(`/submissions/${id}/approve`, {});
      await load();
    } catch (e: any) {
      setError(e?.message || 'Failed to approve submission');
    }
  }

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

      {/* Search and primary filters */}
      <div className='bg-card p-2 rounded border border-border mb-8 flex items-center gap-2'>
        <div className='relative grow'>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void load();
              }
            }}
            className='w-full bg-transparent border-none focus:ring-0 pl-3 text-sm text-foreground placeholder:text-muted-foreground/70 py-3'
            placeholder='Search by title...'
            type='text'
          />
        </div>
        <div className='flex items-center gap-2 pl-2 border-l border-border'>
          <label className='text-xs text-muted-foreground tracking-widest uppercase'>Status</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              const val = e.target.value as StatusFilter;
              setStatusFilter(val);
              void load({ status: val });
            }}
            className='bg-transparent text-sm px-2 py-2 rounded border border-border text-foreground'
          >
            <option value='ALL'>All</option>
            <option value='SUBMITTED'>Submitted</option>
            <option value='APPROVED'>Approved</option>
            <option value='REJECTED'>Rejected</option>
          </select>
        </div>
        <button
          type='button'
          aria-expanded={isFiltersOpen}
          aria-controls='advanced-filters-panel'
          onClick={() => setIsFiltersOpen((open) => !open)}
          className='px-4 py-2 text-muted-foreground hover:text-primary transition-colors border-l border-border text-xs font-semibold tracking-widest'
        >
          {`FILTERS${activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}`}
        </button>
        <button
          onClick={() => {
            setQuery('');
            void load({ q: '' });
          }}
          className='px-4 py-2 text-muted-foreground hover:text-primary transition-colors border-l border-border text-xs font-semibold tracking-widest'
        >
          CLEAR
        </button>
        <button
          onClick={() => void load()}
          className='bg-foreground text-background px-6 py-2.5 rounded text-xs font-bold tracking-widest hover:opacity-90 transition-opacity'
        >
          SEARCH
        </button>
      </div>

      {/* Advanced filters */}
      {isFiltersOpen ? (
        <div
          className='fixed inset-0 z-50 bg-black/45 backdrop-blur-sm px-4 py-8 overflow-y-auto'
          onClick={() => setIsFiltersOpen(false)}
        >
          <div
            id='advanced-filters-panel'
            role='dialog'
            aria-modal='true'
            aria-label='Advanced filters'
            className='mx-auto max-w-6xl bg-card border border-border rounded-lg p-4 md:p-5 space-y-4'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-center justify-between'>
              <h2 className='text-xs font-bold tracking-[0.2em] uppercase text-muted-foreground'>
                Advanced Filters
              </h2>
              <button
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
                className='text-xs font-semibold tracking-widest text-muted-foreground hover:text-primary transition-colors'
              >
                CLEAR ALL FILTERS
              </button>
            </div>

            <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
              <div className='flex flex-col gap-1'>
                <label className='text-[10px] tracking-widest uppercase text-muted-foreground'>Country</label>
                <select
                  value={selectedCountryId}
                  onChange={(e) => setSelectedCountryId(e.target.value)}
                  className='bg-transparent text-sm px-2 py-2 rounded border border-border text-foreground'
                >
                  <option value=''>All Countries</option>
                  {countries.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex flex-col gap-1'>
                <label className='text-[10px] tracking-widest uppercase text-muted-foreground'>Language</label>
                <select
                  value={selectedLanguageId}
                  onChange={(e) => setSelectedLanguageId(e.target.value)}
                  className='bg-transparent text-sm px-2 py-2 rounded border border-border text-foreground'
                >
                  <option value=''>All Languages</option>
                  {languages.map((l) => (
                    <option key={l._id} value={l._id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className='flex flex-col gap-1'>
                <label className='text-[10px] tracking-widest uppercase text-muted-foreground'>Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className='bg-transparent text-sm px-2 py-2 rounded border border-border text-foreground'
                >
                  <option value=''>All Years</option>
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className='space-y-2'>
              <label className='text-[10px] tracking-widest uppercase text-muted-foreground'>
                Categories (multi-select)
              </label>
              <div className='flex flex-wrap gap-2'>
                {contentTypes.map((item) => {
                  const selected = selectedContentTypeIds.includes(item._id);
                  return (
                    <button
                      key={item._id}
                      type='button'
                      onClick={() =>
                        toggleMulti(item._id, selectedContentTypeIds, setSelectedContentTypeIds)
                      }
                      className={`px-2 py-1 rounded-full border text-[10px] uppercase font-semibold tracking-wider transition-colors ${
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
            </div>

            <div className='space-y-2'>
              <label className='text-[10px] tracking-widest uppercase text-muted-foreground'>
                Genres (multi-select)
              </label>
              <div className='flex flex-wrap gap-2'>
                {genres.map((item) => {
                  const selected = selectedGenreIds.includes(item._id);
                  return (
                    <button
                      key={item._id}
                      type='button'
                      onClick={() => toggleMulti(item._id, selectedGenreIds, setSelectedGenreIds)}
                      className={`px-2 py-1 rounded-full border text-[10px] uppercase font-semibold tracking-wider transition-colors ${
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
            </div>

            <div className='flex justify-end gap-2'>
              <button
                type='button'
                onClick={() => setIsFiltersOpen(false)}
                className='px-4 py-2 rounded text-xs font-bold tracking-widest border border-border text-muted-foreground hover:text-primary transition-colors'
              >
                CANCEL
              </button>
              <button
                type='button'
                onClick={() => {
                  void load();
                  setIsFiltersOpen(false);
                }}
                className='bg-foreground text-background px-4 py-2 rounded text-xs font-bold tracking-widest hover:opacity-90 transition-opacity'
              >
                APPLY FILTERS
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
                        {item.status === 'REJECTED' ? (
                          <button
                            onClick={() => void approve(item._id)}
                            className='text-green-500 hover:text-green-400 transition-colors text-[10px] font-bold tracking-widest'
                          >
                            APPROVE
                          </button>
                        ) : null}
                        <button
                          onClick={() => void remove(item._id)}
                          className='text-red-500 hover:text-red-400 transition-colors text-[10px] font-bold tracking-widest'
                        >
                          DELETE
                        </button>
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
