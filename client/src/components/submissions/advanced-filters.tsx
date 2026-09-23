'use client';

import { useEffect, useMemo, useState } from 'react';
import { getData } from '@/lib/fetch-util';
import { Button } from '@/components/ui/button';

/**
 * The "Filters" dialog shared by the submissions list and the review queue.
 * Both hit the same staff `GET /submissions` endpoint, so the filters map
 * one-to-one onto its query params (see `appendFilterParams`).
 *
 * Status is deliberately not in here: the submissions page puts it in the
 * search bar, and the review queue is SUBMITTED-only.
 */

export type AdvancedFilters = {
  contentTypeIds: string[];
  genreIds: string[];
  countryId: string;
  languageId: string;
  year: string;
};

export const EMPTY_FILTERS: AdvancedFilters = {
  contentTypeIds: [],
  genreIds: [],
  countryId: '',
  languageId: '',
  year: '',
};

export const countActiveFilters = (f: AdvancedFilters) =>
  f.contentTypeIds.length +
  f.genreIds.length +
  (f.countryId ? 1 : 0) +
  (f.languageId ? 1 : 0) +
  (f.year ? 1 : 0);

export function appendFilterParams(parts: string[], f: AdvancedFilters) {
  if (f.contentTypeIds.length > 0) {
    parts.push(`contentTypeIds=${encodeURIComponent(f.contentTypeIds.join(','))}`);
  }
  if (f.genreIds.length > 0) {
    parts.push(`genreIds=${encodeURIComponent(f.genreIds.join(','))}`);
  }
  if (f.countryId) parts.push(`countryId=${encodeURIComponent(f.countryId)}`);
  if (f.languageId) parts.push(`languageId=${encodeURIComponent(f.languageId)}`);
  if (f.year) parts.push(`year=${encodeURIComponent(f.year)}`);
  return parts;
}

type FilterOption = { _id: string; name: string };
type OptionsResponse = { success: boolean; data: FilterOption[] };

export type FilterOptions = {
  contentTypes: FilterOption[];
  genres: FilterOption[];
  countries: FilterOption[];
  languages: FilterOption[];
};

const NO_OPTIONS: FilterOptions = { contentTypes: [], genres: [], countries: [], languages: [] };

/** Loads the four lookup lists the dialog offers. Empty on failure. */
export function useFilterOptions(): FilterOptions {
  const [options, setOptions] = useState<FilterOptions>(NO_OPTIONS);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [countriesRes, languagesRes, genresRes, contentTypesRes] = await Promise.all([
          getData<OptionsResponse>('/countries'),
          getData<OptionsResponse>('/languages'),
          getData<OptionsResponse>('/genres'),
          getData<OptionsResponse>('/content-types'),
        ]);
        if (!mounted) return;
        setOptions({
          countries: countriesRes?.data ?? [],
          languages: languagesRes?.data ?? [],
          genres: genresRes?.data ?? [],
          contentTypes: contentTypesRes?.data ?? [],
        });
      } catch {
        if (mounted) setOptions(NO_OPTIONS);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return options;
}

const toggle = (value: string, values: string[]) =>
  values.includes(value) ? values.filter((v) => v !== value) : [...values, value];

type AdvancedFiltersDialogProps = {
  open: boolean;
  onClose: () => void;
  options: FilterOptions;
  value: AdvancedFilters;
  onChange: (next: AdvancedFilters) => void;
  onApply: () => void;
  onClearAll: () => void;
};

export function AdvancedFiltersDialog({
  open,
  onClose,
  options,
  value,
  onChange,
  onApply,
  onClearAll,
}: AdvancedFiltersDialogProps) {
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 40 }, (_, i) => String(currentYear - i));
  }, []);

  if (!open) return null;

  const set = (patch: Partial<AdvancedFilters>) => onChange({ ...value, ...patch });

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/45 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
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
          <Button variant="ghost" size="sm" onClick={onClearAll}>
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
              value={value.countryId}
              onChange={(e) => set({ countryId: e.target.value })}
              className="rounded border border-border bg-transparent px-2 py-2 text-sm text-foreground"
            >
              <option value="">All countries</option>
              {options.countries.map((c) => (
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
              value={value.languageId}
              onChange={(e) => set({ languageId: e.target.value })}
              className="rounded border border-border bg-transparent px-2 py-2 text-sm text-foreground"
            >
              <option value="">All languages</option>
              {options.languages.map((l) => (
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
              value={value.year}
              onChange={(e) => set({ year: e.target.value })}
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
            {options.contentTypes.map((item) => {
              const selected = value.contentTypeIds.includes(item._id);
              return (
                <button
                  key={item._id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => set({ contentTypeIds: toggle(item._id, value.contentTypeIds) })}
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
            {options.genres.map((item) => {
              const selected = value.genreIds.includes(item._id);
              return (
                <button
                  key={item._id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => set({ genreIds: toggle(item._id, value.genreIds) })}
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
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onApply();
              onClose();
            }}
          >
            Apply filters
          </Button>
        </div>
      </div>
    </div>
  );
}
