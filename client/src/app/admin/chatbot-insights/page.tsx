"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import PageShell from "@/components/page-shell";
import PeriodPicker, { periodParams, presetPeriod, type Period } from "@/components/chatbot-insights/period-picker";
import QuestionList, { type ListFilter } from "@/components/chatbot-insights/question-list";
import TemplateEditor from "@/components/chatbot-insights/template-editor";
import TemplateList from "@/components/chatbot-insights/template-list";
import { Button } from "@/components/ui/button";
import { getData } from "@/lib/fetch-util";
import { requestError } from "@/lib/distribution-enquiry";
import { SOURCE_LABEL, setQuestionStatus, type ChatStatus, type TemplateDraft } from "@/lib/chatbot-insights";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-context";

/**
 * What visitors ask the IFFA Assistant (the chatbot on iffa-2026), and the
 * tools to act on it.
 *
 * Three tabs:
 *   Report         the numbers, plus the to-do lists: questions the bot couldn't
 *                  answer and answers visitors disliked (mark done / ignore)
 *   All questions  every question with the bot's answer, paged and searchable
 *   Fixed answers  staff-approved replies the chatbot gives instantly, without the AI
 *
 * Data: backend/controllers/chatQuestion.controller.ts (questions, report) and
 * chatTemplate.controller.ts (fixed answers). Questions asked in different
 * ways ("How do I submit my film?" / "how do i submit my film") are grouped.
 */

type Report = {
  from: string | null;
  to: string | null;
  retentionDays: number;
  total: number;
  unansweredTotal: number;
  feedback: { up: number; down: number };
  mostAsked: { normalized: string; question: string; asked: number; answered: number }[];
  unanswered: { normalized: string; question: string; asked: number; lastAsked: string }[];
  disliked: { normalized: string; question: string; answer: string; votes: number; lastAsked: string }[];
  templates: { normalized: string; question: string; asked: number; answer: string }[];
  bySource: { source: string; count: number }[];
  perDay: { day: string; count: number }[];
};

type View = "report" | "questions" | "fixed";
const VIEWS: [View, string][] = [
  ["report", "Report"],
  ["questions", "All questions"],
  ["fixed", "Fixed answers"],
];

const tabClass = (active: boolean) =>
  cn(
    "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
    active
      ? "border-primary/60 bg-primary/10 text-primary"
      : "border-border text-muted-foreground hover:text-foreground",
  );

const formatDay = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });

const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** A titled block with a plain table, or a short note when there is nothing to show. */
function Section({
  title,
  hint,
  headers,
  rows,
  empty,
  action,
}: {
  title: string;
  hint: string;
  headers: string[];
  rows: ReactNode[][];
  empty: string;
  action?: ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {action}
      </div>
      <p className="mb-3 max-w-prose text-sm text-muted-foreground">{hint}</p>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                {headers.map((h, i) => (
                  <th key={h} className={cn("px-4 py-2 font-medium", i > 0 && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((cells, r) => (
                <tr key={r} className="border-t border-border align-top">
                  {cells.map((c, i) => (
                    <td
                      key={i}
                      className={cn(
                        "px-4 py-2.5",
                        i === 0 ? "text-foreground" : "text-right font-mono tabular-nums text-foreground/80",
                      )}
                    >
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function AdminChatbotInsightsPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>(() => presetPeriod("7"));
  const [view, setView] = useState<View>("report");
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<TemplateDraft | null>(null); // the fixed answer being edited
  const [templatesVersion, setTemplatesVersion] = useState(0); // bumps after a save, so lists reload

  const load = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getData<{ success: boolean; data: Report }>(`/chatbot-questions/report?${new URLSearchParams(periodParams(p))}`);
      if (res?.success && res.data) setReport(res.data);
      else setError("Failed to load the chatbot report");
    } catch (e) {
      const { status, message } = requestError(e);
      setError(
        status === 404
          ? "Chatbot report not available. Deploy the latest backend so the /chatbot-questions route exists."
          : message || "Failed to load the chatbot report",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      router.replace("/");
      return;
    }
    load(period);
  }, [isAuthenticated, user?.role, router, load, period]);

  if (!isAuthenticated || user?.role !== "admin") return null;

  const r = report;
  const count = (source: string) => r?.bySource.find((s) => s.source === source)?.count ?? 0;

  async function triage(normalized: string, status: ChatStatus) {
    try {
      await setQuestionStatus(normalized, status);
      toast.success(status === "done" ? "Marked done" : "Ignored");
      load(period);
    } catch (e) {
      toast.error(requestError(e).message || "Failed to update");
    }
  }

  const showList = (filter: ListFilter) => {
    setListFilter(filter);
    setView("questions");
  };

  const makeFixed = (question: string, answer: string) =>
    setDraft({ question, phrasings: [], answer, active: true });

  /** Row actions for the to-do sections. */
  const actions = (normalized: string, question: string, answer = "") => (
    <div className="flex flex-wrap justify-end gap-x-3 gap-y-1 font-sans">
      <Button variant="rowAction" size="inline" onClick={() => makeFixed(question, answer)}>
        Make fixed answer
      </Button>
      <Button variant="rowPositive" size="inline" onClick={() => triage(normalized, "done")}>
        Done
      </Button>
      <Button variant="rowAction" size="inline" onClick={() => triage(normalized, "ignored")}>
        Ignore
      </Button>
    </div>
  );

  return (
    <PageShell
      title="Chatbot insights"
      description="What visitors ask the IFFA Assistant on the website. Use it to find information missing from the site, fix answers visitors didn't like, and turn common questions into instant fixed answers. Questions are anonymous; emails and phone numbers are removed before saving."
    >
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="tablist" aria-label="View" className="flex flex-wrap gap-2">
          {VIEWS.map(([v, label]) => (
            <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={tabClass(view === v)}>
              {label}
            </button>
          ))}
        </div>
        {view !== "fixed" && (
          <PeriodPicker period={period} onChange={setPeriod} retentionDays={r?.retentionDays} />
        )}
      </div>

      {error && (
        <p role="alert" className="mb-8 rounded-lg border border-destructive/40 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {view !== "fixed" && (
        <dl className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-5">
          {[
            { label: "Questions", value: r?.total },
            { label: "Not answered (open)", value: r?.unansweredTotal },
            { label: "Disliked answers", value: r?.feedback.down },
            { label: "Answered by AI", value: r && count("ai") },
            { label: "Instant (fixed / cache / small talk)", value: r && count("template") + count("cache") + count("smalltalk") },
          ].map((s) => (
            <div key={s.label} className="bg-background px-4 py-3">
              <dt className="text-xs text-muted-foreground">{s.label}</dt>
              <dd className="mt-1 font-mono text-2xl tabular-nums text-foreground">
                {loading || s.value === undefined ? "—" : s.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {view === "questions" && (
        <QuestionList
          {...periodParams(period)}
          filter={listFilter}
          onFilterChange={setListFilter}
          onMakeTemplate={setDraft}
          onChanged={() => load(period)}
        />
      )}

      {view === "fixed" && <TemplateList refreshKey={templatesVersion} onEdit={setDraft} />}

      {view === "report" && r && !loading && (
        <>
          <Section
            title="Not answered"
            hint="The assistant said it doesn't have this information. Add it to the site, or make a fixed answer, then mark it done. Ignore the ones that need nothing."
            headers={["Question", "Asked", "Last asked", ""]}
            rows={r.unanswered.map((q) => [
              q.question,
              q.asked,
              formatDateTime(q.lastAsked),
              actions(q.normalized, q.question),
            ])}
            empty="Nothing to do: every question in this period was answered or handled."
            action={
              r.unanswered.length > 0 && (
                <button type="button" onClick={() => showList("unanswered")} className="shrink-0 text-sm font-medium text-primary hover:underline">
                  See all with answers
                </button>
              )
            }
          />
          <Section
            title="Disliked answers"
            hint="Visitors pressed thumbs down. Check the answer: fix the site content or make a fixed answer with better wording, then mark it done."
            headers={["Question and answer", "Votes", ""]}
            rows={r.disliked.map((q) => [
              <div key="q" className="space-y-1">
                <p className="font-medium">{q.question}</p>
                <p className="line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">{q.answer}</p>
              </div>,
              q.votes,
              actions(q.normalized, q.question, q.answer),
            ])}
            empty="No thumbs down in this period."
            action={
              r.disliked.length > 0 && (
                <button type="button" onClick={() => showList("disliked")} className="shrink-0 text-sm font-medium text-primary hover:underline">
                  See all
                </button>
              )
            }
          />
          <Section
            title={`Fixed-answer candidates (last ${r.retentionDays} days)`}
            hint="Answered questions asked 3 or more times. A fixed answer for these would be instant and wouldn't use the free AI quota."
            headers={["Question and latest answer", "Asked", ""]}
            rows={r.templates.map((t) => [
              <div key="q" className="space-y-1">
                <p className="font-medium">{t.question}</p>
                <p className="line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">{t.answer}</p>
              </div>,
              t.asked,
              <Button key="a" variant="rowAction" size="inline" onClick={() => makeFixed(t.question, t.answer)}>
                Make fixed answer
              </Button>,
            ])}
            empty="No question has been asked 3 times yet."
          />
          <Section
            title="Most asked"
            hint="Questions asked in different ways are counted together. Small talk is left out."
            headers={["Question", "Asked", "Answered"]}
            rows={r.mostAsked.map((q) => [q.question, q.asked, `${q.answered}/${q.asked}`])}
            empty="No questions yet in this period."
          />
          <Section
            title="How questions were answered"
            hint="AI answers use the free daily quota; fixed answers, cached answers and small talk don't."
            headers={["Source", "Questions"]}
            rows={r.bySource.map((s) => [SOURCE_LABEL[s.source] ?? s.source, s.count])}
            empty="No questions yet in this period."
          />
          <Section
            title="Questions per day"
            hint={`Melbourne time. Thumbs up: ${r.feedback.up} · thumbs down: ${r.feedback.down}.`}
            headers={["Day", "Questions"]}
            rows={r.perDay.map((d) => [formatDay(d.day), d.count])}
            empty="No questions yet in this period."
          />
        </>
      )}

      <TemplateEditor
        draft={draft}
        onClose={() => setDraft(null)}
        onSaved={() => {
          setTemplatesVersion((v) => v + 1);
          load(period);
        }}
      />
    </PageShell>
  );
}
