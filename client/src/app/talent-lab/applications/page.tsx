"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteData, getData, patchData } from "@/lib/fetch-util";
import { useAuth } from "@/providers/auth-context";
import PageShell from "@/components/page-shell";
import RecordList, { type Column } from "@/components/record-list";
import { inputClass } from "@/components/form-section";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/talent-lab-status-badge";
import ConfirmDialog from "@/components/confirm-dialog";
import { toast } from "sonner";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  QUICK_ACTIONS,
  downloadCsv,
  formatDate,
  requestError,
  type ApplicationStatus,
  type TalentLabApplication,
} from "@/lib/talent-lab";

export default function TalentLabApplicationsPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const isStaff = user?.role === "admin" || user?.role === "staff";
  const [list, setList] = useState<TalentLabApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // "active" hides archived applications, as the film review queue does.
  const [status, setStatus] = useState<"" | "active" | ApplicationStatus>("active");
  const [program, setProgram] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingBulk, setPendingBulk] = useState<(typeof QUICK_ACTIONS)[number] | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [deleting, setDeleting] = useState<TalentLabApplication | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(new Set());
    try {
      const res = await getData<{ success: boolean; data: TalentLabApplication[] }>(
        "/talent-lab/applications",
      );
      setList(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      const { status: code, message } = requestError(e);
      setError(
        code === 404
          ? "Applications aren't available yet. Deploy the latest backend so /talent-lab/applications exists."
          : message || "Failed to load applications",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && !isStaff) {
      router.replace("/");
      return;
    }
    if (isAuthenticated) void load();
  }, [isAuthenticated, isStaff, router, load]);

  const programs = useMemo(
    () => Array.from(new Set(list.map((a) => a.program))).sort(),
    [list],
  );
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter(
      (a) =>
        (!status || (status === "active" ? a.status !== "archived" : a.status === status)) &&
        (!program || a.program === program) &&
        (!q || [a.fullName, a.email, a.reference].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [list, status, program, query]);

  // A selection only ever covers rows on screen: changing a filter drops the rest.
  useEffect(() => {
    setSelected((prev) => {
      const visible = new Set(shown.map((a) => a._id));
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [shown]);

  const runBulk = async (action: (typeof QUICK_ACTIONS)[number]) => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const res = await patchData<{ success: boolean; data: { updated: number } }>(
        "/talent-lab/applications/bulk-status",
        { ids, status: action.status },
      );
      const n = res?.data?.updated ?? 0;
      toast.success(`${n} application${n === 1 ? "" : "s"} ${action.done}`);
      setPendingBulk(null);
      await load();
    } catch (e) {
      toast.error(requestError(e).message || "Failed to update the applications");
      setPendingBulk(null);
    } finally {
      setBulkBusy(false);
    }
  };

  const remove = async (a: TalentLabApplication) => {
    try {
      await deleteData(`/talent-lab/applications/${a._id}`);
      toast.success("Application deleted");
      setList((l) => l.filter((x) => x._id !== a._id));
    } catch (e) {
      toast.error(requestError(e).message || "Failed to delete the application");
    }
  };

  if (isAuthenticated && !isStaff) return null;

  const columns: Column<TalentLabApplication>[] = [
    {
      key: "applicant",
      header: "Applicant",
      role: "title",
      cell: (a) => (
        <div className="min-w-0">
          <h3 className="truncate font-serif text-lg text-foreground">{a.fullName}</h3>
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-mono">{a.reference}</span> ·{" "}
            <a href={`mailto:${a.email}`} className="text-primary underline-offset-4 hover:underline">
              {a.email}
            </a>
          </p>
        </div>
      ),
    },
    { key: "program", header: "Program", cell: (a) => <span className="text-foreground/80">{a.program}</span> },
    {
      key: "discipline",
      header: "Discipline",
      showFrom: "xl",
      cell: (a) => (
        <span className="text-foreground/80">
          {a.primaryDiscipline} · {a.careerStage}
        </span>
      ),
    },
    { key: "status", header: "Status", cell: (a) => <StatusBadge status={a.status} /> },
    {
      key: "received",
      header: "Received",
      cell: (a) => (
        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          {a.createdAt ? formatDate(a.createdAt) : "—"}
        </span>
      ),
    },
  ];

  const exportCsv = () =>
    downloadCsv("talent-lab-applications.csv", [
      ["Reference", "Received", "Status", "Name", "Email", "Phone", "Program", "Discipline", "Career stage", "Location", "Portfolio"],
      ...shown.map((a) => [
        a.reference,
        a.createdAt ? formatDate(a.createdAt) : "",
        APPLICATION_STATUS_LABELS[a.status] ?? a.status,
        a.fullName,
        a.email,
        a.phone,
        a.program,
        a.primaryDiscipline,
        a.careerStage,
        a.location,
        a.portfolioLink,
      ]),
    ]);

  return (
    <PageShell
      title="Talent Lab applications"
      description="Applications from the public site's Talent Lab Apply form. Open one to read it in full, set its status and keep notes."
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Search applications"
          placeholder="Search by name, email or reference"
          className={`${inputClass} w-full sm:w-72`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Filter by status"
          className={`${inputClass} w-auto`}
          value={status}
          onChange={(e) => setStatus(e.target.value as "" | "active" | ApplicationStatus)}
        >
          <option value="active">All except archived</option>
          <option value="">All statuses</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {APPLICATION_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by program"
          className={`${inputClass} w-auto`}
          value={program}
          onChange={(e) => setProgram(e.target.value)}
        >
          <option value="">All programs</option>
          {programs.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={!shown.length}>
          Export CSV
        </Button>
      </div>

      {selected.size > 0 && (
        <div
          role="region"
          aria-label="Bulk actions"
          className="sticky top-[calc(var(--header-h)+0.5rem)] z-20 mb-4 flex flex-col gap-2 rounded-lg border border-border-strong bg-surface-overlay p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="shrink-0 whitespace-nowrap text-sm text-foreground" aria-live="polite">
            {selected.size} selected
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {QUICK_ACTIONS.map((a) => (
              <Button key={a.status} size="sm" variant="outline" onClick={() => setPendingBulk(a)} disabled={bulkBusy}>
                {a.label}
              </Button>
            ))}
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} disabled={bulkBusy}>
              Clear selection
            </Button>
          </div>
        </div>
      )}

      <RecordList
        selection={{
          selected,
          onChange: setSelected,
          label: (key) => `Select ${list.find((a) => a._id === key)?.fullName ?? "application"}`,
        }}
        items={shown}
        columns={columns}
        getKey={(a) => a._id}
        loading={loading}
        error={error}
        empty={list.length ? "No applications match these filters." : "No applications have come in yet."}
        actions={(a) => (
          <div className="flex items-center gap-4">
            <Button variant="rowAction" size="inline" onClick={() => router.push(`/talent-lab/applications/${a._id}`)}>
              Open
            </Button>
            <Button variant="rowDanger" size="inline" onClick={() => setDeleting(a)}>
              Delete
            </Button>
          </div>
        )}
      />

      {!loading && !error && list.length > 0 && (
        <p className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
          {`Showing ${shown.length} of ${list.length} ${list.length === 1 ? "application" : "applications"}`}
        </p>
      )}

      <ConfirmDialog
        open={pendingBulk !== null && selected.size > 0}
        title={pendingBulk ? `${pendingBulk.label} ${selected.size} application${selected.size === 1 ? "" : "s"}?` : ""}
        description={
          <>
            {list
              .filter((a) => selected.has(a._id))
              .slice(0, 10)
              .map((a) => `${a.fullName} (${a.reference})`)
              .join(", ")}
            {selected.size > 10 ? ` and ${selected.size - 10} more` : ""}
          </>
        }
        confirmLabel={pendingBulk?.label ?? "Confirm"}
        busy={bulkBusy}
        onCancel={() => setPendingBulk(null)}
        onConfirm={() => {
          if (pendingBulk) void runBulk(pendingBulk);
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        tone="danger"
        title="Delete this application?"
        description={
          <>
            <span className="text-foreground">{deleting?.fullName}</span>&apos;s application ({deleting?.reference}) will
            be removed. This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete application"
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target) void remove(target);
        }}
      />
    </PageShell>
  );
}
