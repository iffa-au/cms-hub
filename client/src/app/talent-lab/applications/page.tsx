"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getData } from "@/lib/fetch-util";
import { useAuth } from "@/providers/auth-context";
import PageShell from "@/components/page-shell";
import RecordList, { type Column } from "@/components/record-list";
import { inputClass } from "@/components/form-section";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/talent-lab-status-badge";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
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
  const [status, setStatus] = useState<"" | ApplicationStatus>("");
  const [program, setProgram] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
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
  const shown = useMemo(
    () => list.filter((a) => (!status || a.status === status) && (!program || a.program === program)),
    [list, status, program],
  );

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
        <select
          aria-label="Filter by status"
          className={`${inputClass} w-auto`}
          value={status}
          onChange={(e) => setStatus(e.target.value as "" | ApplicationStatus)}
        >
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

      <RecordList
        items={shown}
        columns={columns}
        getKey={(a) => a._id}
        loading={loading}
        error={error}
        empty={list.length ? "No applications match these filters." : "No applications have come in yet."}
        actions={(a) => (
          <Button variant="rowAction" size="inline" onClick={() => router.push(`/talent-lab/applications/${a._id}`)}>
            Open
          </Button>
        )}
      />

      {!loading && !error && list.length > 0 && (
        <p className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
          {`Showing ${shown.length} of ${list.length} ${list.length === 1 ? "application" : "applications"}`}
        </p>
      )}
    </PageShell>
  );
}
