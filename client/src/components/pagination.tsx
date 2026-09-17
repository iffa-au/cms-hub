"use client";

import { cn } from "@/lib/utils";

/**
 * Windowed pagination. The submissions list rendered one button per page,
 * which at 267 records was a row of numbers wider than a phone.
 *
 * Below `sm` the numbers are dropped entirely for a plain "Page 3 of 12" —
 * on a touch target that narrow, tapping a specific page is not a real action.
 */
const WINDOW = 5;

function windowed(page: number, total: number) {
  const half = Math.floor(WINDOW / 2);
  let start = Math.max(1, page - half);
  const end = Math.min(total, start + WINDOW - 1);
  start = Math.max(1, end - WINDOW + 1);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

const btn =
  "h-9 min-w-9 rounded border px-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40";

export default function Pagination({
  page,
  totalPages,
  onPage,
  disabled = false,
  summary,
}: {
  page: number;
  totalPages: number;
  onPage: (page: number) => void;
  disabled?: boolean;
  summary?: string;
}) {
  if (totalPages <= 1 && !summary) return null;
  const pages = windowed(page, totalPages);

  return (
    <nav
      aria-label="Pagination"
      className="mt-8 flex flex-col gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between"
    >
      {summary && (
        <p className="text-xs text-muted-foreground">{summary}</p>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={disabled || page <= 1}
            className={cn(btn, "border-border text-foreground hover:border-primary")}
          >
            Previous
          </button>

          <span className="text-xs text-muted-foreground sm:hidden">
            Page {page} of {totalPages}
          </span>

          <div className="hidden items-center gap-1 sm:flex">
            {pages[0] > 1 && (
              <>
                <PageButton n={1} page={page} onPage={onPage} disabled={disabled} />
                {pages[0] > 2 && (
                  <span className="px-1 text-xs text-muted-foreground" aria-hidden>
                    &hellip;
                  </span>
                )}
              </>
            )}
            {pages.map((n) => (
              <PageButton key={n} n={n} page={page} onPage={onPage} disabled={disabled} />
            ))}
            {pages[pages.length - 1] < totalPages && (
              <>
                {pages[pages.length - 1] < totalPages - 1 && (
                  <span className="px-1 text-xs text-muted-foreground" aria-hidden>
                    &hellip;
                  </span>
                )}
                <PageButton
                  n={totalPages}
                  page={page}
                  onPage={onPage}
                  disabled={disabled}
                />
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={disabled || page >= totalPages}
            className={cn(btn, "border-border text-foreground hover:border-primary")}
          >
            Next
          </button>
        </div>
      )}
    </nav>
  );
}

function PageButton({
  n,
  page,
  onPage,
  disabled,
}: {
  n: number;
  page: number;
  onPage: (p: number) => void;
  disabled: boolean;
}) {
  const current = n === page;
  return (
    <button
      type="button"
      onClick={() => onPage(n)}
      disabled={disabled}
      aria-current={current ? "page" : undefined}
      className={cn(
        btn,
        current
          ? "border-primary bg-primary/15 text-primary"
          : "border-border text-foreground hover:border-primary",
      )}
    >
      {n}
    </button>
  );
}
