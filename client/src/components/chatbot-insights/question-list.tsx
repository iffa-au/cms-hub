"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Search, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import ConfirmDialog from "@/components/confirm-dialog";
import Pagination from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/form-section";
import { deleteData, getData } from "@/lib/fetch-util";
import { requestError } from "@/lib/distribution-enquiry";
import { cn } from "@/lib/utils";
import {
  SOURCE_LABEL,
  downloadQuestionsCsv,
  setQuestionStatus,
  type ChatStatus,
  type TemplateDraft,
} from "@/lib/chatbot-insights";

/**
 * Every question visitors asked the IFFA Assistant, newest first, with the
 * answer it gave, the page it was asked on and the visitor's thumbs up / down.
 * One page at a time from GET /chatbot-questions (admin only), so it stays fast
 * however many questions there are.
 */

export type ListFilter = "all" | "unanswered" | "disliked" | "answered";

type ChatQuestion = {
  _id: string;
  question: string;
  answer: string;
  answered: boolean;
  source: string;
  normalized: string;
  page?: string;
  feedback?: "" | "up" | "down";
  status?: ChatStatus;
  createdAt: string;
};

/** Questions per page; the visitor picks one. The backend allows up to 100. */
const PAGE_SIZES = [20, 50, 100] as const;
type PageSize = (typeof PAGE_SIZES)[number];

const FILTERS: { value: ListFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unanswered", label: "Not answered" },
  { value: "disliked", label: "Disliked" },
  { value: "answered", label: "Answered" },
];

const STATUS_LABEL: Record<ChatStatus, string> = { open: "Open", done: "Done", ignored: "Ignored" };

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const chip = "rounded-full border px-2 py-0.5";

/** One question with its answer; long answers start folded. */
function QuestionRow({
  item,
  onStatus,
  onMakeTemplate,
  onDelete,
}: {
  item: ChatQuestion;
  onStatus: (item: ChatQuestion, status: ChatStatus) => void;
  onMakeTemplate: (item: ChatQuestion) => void;
  onDelete: (item: ChatQuestion) => void;
}) {
  const [open, setOpen] = useState(false);
  const long = item.answer.length > 220;
  const status = item.status ?? "open";
  // Only questions that need attention get a to-do status.
  const triage = !item.answered || item.feedback === "down";

  return (
    <li className="border-t border-border px-4 py-4 first:border-t-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <p className="font-medium text-foreground">{item.question}</p>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-xs">
          <span
            className={cn(
              chip,
              item.answered
                ? "border-border text-muted-foreground"
                : "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400",
            )}
          >
            {item.answered ? "Answered" : "Not answered"}
          </span>
          {item.feedback === "down" && (
            <span className={cn(chip, "inline-flex items-center gap-1 border-destructive/50 text-destructive")}>
              <ThumbsDown className="size-3" aria-hidden /> Disliked
            </span>
          )}
          {item.feedback === "up" && (
            <span className={cn(chip, "inline-flex items-center gap-1 border-border text-muted-foreground")}>
              <ThumbsUp className="size-3" aria-hidden /> Liked
            </span>
          )}
          {triage && status !== "open" && (
            <span className={cn(chip, "border-border text-muted-foreground")}>{STATUS_LABEL[status]}</span>
          )}
          <span className={cn(chip, "border-border text-muted-foreground")}>
            {SOURCE_LABEL[item.source] ?? item.source}
          </span>
        </div>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        <time dateTime={item.createdAt}>{formatDateTime(item.createdAt)}</time>
        {item.page ? ` · asked on ${item.page}` : ""}
      </p>

      {item.answer && (
        <div className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-sm text-foreground/80">
          <p className={cn("whitespace-pre-line", long && !open && "line-clamp-3")}>{item.answer}</p>
          {long && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="mt-1 text-xs font-medium text-primary hover:underline"
            >
              {open ? "Show less" : "Show full answer"}
            </button>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        <Button variant="rowAction" size="inline" onClick={() => onMakeTemplate(item)}>
          Make fixed answer
        </Button>
        {triage &&
          (status === "open" ? (
            <>
              <Button variant="rowPositive" size="inline" onClick={() => onStatus(item, "done")}>
                Mark done
              </Button>
              <Button variant="rowAction" size="inline" onClick={() => onStatus(item, "ignored")}>
                Ignore
              </Button>
            </>
          ) : (
            <Button variant="rowAction" size="inline" onClick={() => onStatus(item, "open")}>
              Reopen
            </Button>
          ))}
        <Button variant="rowDanger" size="inline" onClick={() => onDelete(item)}>
          Delete
        </Button>
      </div>
    </li>
  );
}

export default function QuestionList({
  from,
  to,
  filter,
  onFilterChange,
  onMakeTemplate,
  onChanged,
}: {
  /** The period shown, as exact start / end times (period-picker.tsx). */
  from: string;
  to: string;
  filter: ListFilter;
  onFilterChange: (value: ListFilter) => void;
  onMakeTemplate: (draft: TemplateDraft) => void;
  /** Called after a status change or delete, so the report's numbers can refresh. */
  onChanged?: () => void;
}) {
  const [items, setItems] = useState<ChatQuestion[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(20);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState(""); // `search` after the visitor stops typing
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChatQuestion | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Number of the latest request: a slower, older response must not overwrite a newer one.
  const latest = useRef(0);

  // Wait until typing pauses before searching, so each key press isn't a request.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // A new filter, search, period or page size starts again from page 1.
  useEffect(() => setPage(1), [filter, query, from, to, pageSize]);

  /** The list's filters as API parameters (shared by the list and the CSV export). */
  const params = useCallback(() => {
    const p = new URLSearchParams({ from, to });
    if (filter === "unanswered") p.set("answered", "false");
    if (filter === "answered") p.set("answered", "true");
    if (filter === "disliked") p.set("feedback", "down");
    if (query) p.set("q", query);
    return p;
  }, [from, to, filter, query]);

  const load = useCallback(async () => {
    const id = ++latest.current;
    setLoading(true);
    setError(null);
    const p = params();
    p.set("page", String(page));
    p.set("limit", String(pageSize));
    try {
      const res = await getData<{
        success: boolean;
        data: ChatQuestion[];
        meta: { page: number; limit: number; total: number };
      }>(`/chatbot-questions?${p}`);
      if (id !== latest.current) return;
      if (res?.success && Array.isArray(res.data)) {
        setItems(res.data);
        setTotal(res.meta?.total ?? res.data.length);
      } else {
        setError("Failed to load questions");
      }
    } catch (e) {
      if (id === latest.current) setError(requestError(e).message || "Failed to load questions");
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [params, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  async function changeStatus(item: ChatQuestion, status: ChatStatus) {
    try {
      const n = await setQuestionStatus(item.normalized, status);
      toast.success(
        status === "open"
          ? "Reopened"
          : `Marked ${STATUS_LABEL[status].toLowerCase()}${n > 1 ? ` (${n} questions asked this way)` : ""}`,
      );
      load();
      onChanged?.();
    } catch (e) {
      toast.error(requestError(e).message || "Failed to update");
    }
  }

  async function remove() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteData(`/chatbot-questions/${pendingDelete._id}`);
      toast.success("Question deleted");
      setPendingDelete(null);
      load();
      onChanged?.();
    } catch (e) {
      toast.error(requestError(e).message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      await downloadQuestionsCsv(params());
    } catch (e) {
      toast.error(requestError(e).message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Show" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => onFilterChange(f.value)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                filter === f.value
                  ? "border-primary/60 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Per page
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}
              className={cn(inputClass, "h-9 w-auto py-0 pr-8")}
            >
              {PAGE_SIZES.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="relative block sm:w-64">
            <span className="sr-only">Search questions</span>
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions…"
              className={cn(inputClass, "pl-9")}
            />
          </label>
          <Button variant="outline" onClick={exportCsv} disabled={exporting || total === 0}>
            <Download aria-hidden /> {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-destructive/40 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {loading && items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          Loading…
        </p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          {query ? `No questions match "${query}".` : "No questions in this period."}
        </p>
      ) : (
        <ul className={cn("rounded-lg border border-border transition-opacity", loading && "opacity-60")}>
          {items.map((item) => (
            <QuestionRow
              key={item._id}
              item={item}
              onStatus={changeStatus}
              onDelete={setPendingDelete}
              onMakeTemplate={(q) => onMakeTemplate({ question: q.question, phrasings: [], answer: q.answer, active: true })}
            />
          ))}
        </ul>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        onPage={(p) => {
          setPage(p);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        disabled={loading}
        summary={total ? `Showing ${first}–${last} of ${total.toLocaleString("en-AU")} questions` : undefined}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this question?"
        description={pendingDelete ? `"${pendingDelete.question}". Use this for tests and junk; it can't be undone.` : undefined}
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
        onConfirm={remove}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  );
}
