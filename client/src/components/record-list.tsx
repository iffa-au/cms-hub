import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { StatusChip, statusBar, statusEdge, type RecordStatus } from "./status";

/**
 * One list, two shapes.
 *
 * Above `lg` this is a real table with a header that sticks under the navbar.
 * Below it, each record becomes a card, because six of these tables carried up
 * to eight columns behind nothing but `overflow-x-auto` — which technically
 * scrolls but means reading a film's details by dragging sideways.
 *
 * There is deliberately no overflow container around the table: `overflow-x`
 * makes an element a scroll container, which silently kills `position: sticky`
 * on the header. Columns that don't earn their width at `lg` should be given
 * `showFrom: "xl"` instead of being scrolled off-screen.
 */
export type Column<T> = {
  key: string;
  header: string;
  align?: "left" | "center" | "right";
  /** Widest-first: the column only enters the table at this breakpoint. */
  showFrom?: "xl";
  /** How this value appears in the card shown below `lg`. */
  role?: "title" | "detail" | "cardHidden";
  /** Constrains the column in the table view; pair with `truncate` in `cell`. */
  width?: string;
  cell: (item: T) => ReactNode;
};

const ALIGN = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

// Literal class names — Tailwind can't see an interpolated one.
const SHOW_FROM = { xl: "hidden xl:table-cell" } as const;

type Props<T> = {
  items: T[];
  columns: Column<T>[];
  getKey: (item: T) => string;
  /** Drives the coloured left edge and the card's chip. */
  getStatus?: (item: T) => RecordStatus | undefined;
  actions?: (item: T) => ReactNode;
  loading?: boolean;
  error?: string | null;
  /** Shown when there is nothing to list — an invitation, not a dead end. */
  empty?: ReactNode;
  skeletonRows?: number;
};

export default function RecordList<T>({
  items,
  columns,
  getKey,
  getStatus,
  actions,
  loading = false,
  error = null,
  empty = "Nothing here yet.",
  skeletonRows = 5,
}: Props<T>) {
  const titleCol = columns.find((c) => c.role === "title") ?? columns[0];
  const detailCols = columns.filter(
    (c) => c !== titleCol && c.role !== "cardHidden",
  );
  const span = columns.length + (actions ? 1 : 0);

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-status-rejected/35 bg-status-rejected/10 px-4 py-3 text-sm text-status-rejected"
      >
        {error}
      </p>
    );
  }

  if (loading) return <Skeleton rows={skeletonRows} span={span} columns={columns} />;

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
        {empty}
      </div>
    );
  }

  return (
    <>
      {/* Table — lg and up */}
      <table className="hidden w-full border-t border-border text-left lg:table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  // sticky lives on the cells, not the row: thead sticky is
                  // unreliable across browsers.
                  "sticky top-[var(--header-h)] z-10 border-b border-border-strong bg-surface-dark px-4 py-3 text-xs font-semibold text-muted-foreground",
                  ALIGN[c.align ?? "left"],
                  c.showFrom && SHOW_FROM[c.showFrom],
                  c.width,
                )}
              >
                {c.header}
              </th>
            ))}
            {actions && (
              <th
                scope="col"
                className="sticky top-[var(--header-h)] z-10 border-b border-border-strong bg-surface-dark px-4 py-3 text-right text-xs font-semibold text-muted-foreground"
              >
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const status = getStatus?.(item);
            return (
              <tr
                key={getKey(item)}
                className="border-b border-border transition-colors hover:bg-surface-dark/60"
              >
                {columns.map((c, i) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-4 py-4 align-middle text-sm",
                      // The status rides the first cell's edge, so it reads
                      // down the whole list without costing a column.
                      i === 0 && "border-l-2",
                      i === 0 && statusEdge(status),
                      ALIGN[c.align ?? "left"],
                      c.showFrom && SHOW_FROM[c.showFrom],
                    )}
                  >
                    {c.cell(item)}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-4 text-right align-middle">
                    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                      {actions(item)}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Cards — below lg */}
      <ul className="space-y-3 lg:hidden">
        {items.map((item) => {
          const status = getStatus?.(item);
          return (
            <li
              key={getKey(item)}
              className="relative overflow-hidden rounded-lg border border-border bg-card/60 p-4 pl-5"
            >
              <span
                aria-hidden
                className={cn("absolute inset-y-0 left-0 w-1", statusBar(status))}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">{titleCol?.cell(item)}</div>
                {status && <StatusChip status={status} />}
              </div>

              {detailCols.length > 0 && (
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                  {detailCols.map((c) => (
                    <div key={c.key} className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{c.header}</dt>
                      <dd className="mt-0.5 text-sm">{c.cell(item)}</dd>
                    </div>
                  ))}
                </dl>
              )}

              {actions && (
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
                  {actions(item)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Skeleton<T>({
  rows,
  span,
  columns,
}: {
  rows: number;
  span: number;
  columns: Column<T>[];
}) {
  const bars = Array.from({ length: rows });
  return (
    <>
      <table className="hidden w-full border-t border-border lg:table">
        <tbody>
          {bars.map((_, i) => (
            <tr key={i} className="border-b border-border">
              <td className="px-4 py-5" colSpan={span || columns.length}>
                <div className="h-4 w-1/3 animate-pulse rounded bg-border" />
                <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-border" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="space-y-3 lg:hidden">
        {bars.map((_, i) => (
          <li key={i} className="rounded-lg border border-border bg-card/60 p-4">
            <div className="h-4 w-1/2 animate-pulse rounded bg-border" />
            <div className="mt-3 h-3 w-3/4 animate-pulse rounded bg-border" />
          </li>
        ))}
      </ul>
      <span className="sr-only" role="status">
        Loading
      </span>
    </>
  );
}
