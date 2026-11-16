"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, ExternalLink, Mail, Search } from "lucide-react";
import { toast } from "sonner";

import PageShell from "@/components/page-shell";
import RecordList, { type Column } from "@/components/record-list";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/form-section";
import { getData, patchData } from "@/lib/fetch-util";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-context";
import {
  MEDIA_TYPE_LABEL,
  PLATFORM_LABEL,
  STATUS_CHIP,
  STATUS_OPTIONS,
  TYPE_LABEL,
  headcount,
  registrationsToCsv,
  type AttendeeType,
  type EventRegistration,
  type RegistrationStatus,
} from "@/lib/event-registration";
import type { RecordStatus } from "@/components/status";

type TypeFilter = "all" | AttendeeType;
type StatusFilter = "all" | RegistrationStatus;

const TYPE_TABS: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "influencer", label: "Influencers" },
  { value: "media", label: "Media / press" },
  { value: "audience", label: "General audience" },
];

// Rides the coloured left edge of each row.
const EDGE: Partial<Record<RegistrationStatus, RecordStatus>> = {
  pending: "SUBMITTED",
  approved: "APPROVED",
  waitlisted: "NOMINATED",
  declined: "REJECTED",
};

const formatDate = (d?: string) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return d;
  }
};

/** The one line under a name that says who this person is. */
function descriptor(r: EventRegistration): string {
  if (r.attendeeType === "media") {
    const type = r.media?.mediaType ? MEDIA_TYPE_LABEL[r.media.mediaType] : "";
    return [r.media?.roleTitle, r.media?.outlet, type].filter(Boolean).join(" · ");
  }
  if (r.attendeeType === "influencer") {
    const platform = r.socialPlatform ? PLATFORM_LABEL[r.socialPlatform] ?? "" : "";
    return [[platform, r.socialHandle].filter(Boolean).join(" "), r.contentNiche]
      .filter(Boolean)
      .join(" · ");
  }
  return r.guests ? `+${r.guests} guest${r.guests === 1 ? "" : "s"}` : "Attending alone";
}

export default function AdminEventRegistrationsPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [list, setList] = useState<EventRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getData<{ success: boolean; data: EventRegistration[] }>(
        "/event-registrations",
      );
      if (res?.success && Array.isArray(res.data)) setList(res.data);
      else setError("Couldn't load registrations.");
    } catch (e: any) {
      if (e?.response?.status === 404) {
        setError(
          "The registrations API isn't live yet. Deploy the backend with the /event-registrations route.",
        );
      } else {
        setError(e?.message || "Couldn't load registrations.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      router.replace("/");
      return;
    }
    load();
  }, [isAuthenticated, user?.role, router, load]);

  const setStatus = useCallback(async (item: EventRegistration, status: RegistrationStatus) => {
    setSaving(item._id);
    try {
      const res = await patchData<{ success: boolean; data: EventRegistration }>(
        `/event-registrations/${item._id}`,
        { status },
      );
      if (res?.data) {
        setList((prev) => prev.map((r) => (r._id === item._id ? res.data : r)));
      }
      toast.success(`${item.fullName} marked ${status}`);
    } catch (e: any) {
      toast.error(e?.message || "Couldn't update the status");
    } finally {
      setSaving(null);
    }
  }, []);

  const counts = useMemo(() => {
    const byType = { influencer: 0, media: 0, audience: 0 } as Record<AttendeeType, number>;
    let pending = 0;
    let approvedSeats = 0;
    let checkedIn = 0;
    for (const r of list) {
      byType[r.attendeeType] += 1;
      if (r.status === "pending") pending += 1;
      if (r.status === "approved") approvedSeats += headcount(r);
      if (r.checkedIn) checkedIn += 1;
    }
    return { byType, pending, approvedSeats, checkedIn };
  }, [list]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((r) => {
      if (typeFilter !== "all" && r.attendeeType !== typeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        r.fullName,
        r.email,
        r.phone,
        r.media?.outlet,
        r.socialHandle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [list, typeFilter, statusFilter, query]);

  // The public form lives on this same CMS, at /attend, and needs no login.
  const formUrl = typeof window !== "undefined" ? `${window.location.origin}/attend` : "/attend";
  const emailHref = `mailto:?subject=${encodeURIComponent(
    "Register for the IFFA 2026 awards night",
  )}&body=${encodeURIComponent(
    `Hi,\n\nYou can request your seat at the IFFA 2026 awards night here:\n${formUrl}\n\nThe IFFA team`,
  )}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(formUrl);
      toast.success("Registration link copied");
    } catch {
      toast.error("Couldn't copy — select the link and copy it instead");
    }
  };

  const exportCsv = () => {
    const csv = registrationsToCsv(visible);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `iffa-guest-list-${typeFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isAuthenticated || user?.role !== "admin") return null;

  const columns: Column<EventRegistration>[] = [
    {
      key: "person",
      header: "Registrant",
      role: "title",
      cell: (r) => (
        <div className="min-w-0">
          <h3 className="truncate font-serif text-lg text-foreground">{r.fullName}</h3>
          <p className="truncate text-xs text-muted-foreground">
            <a
              href={`mailto:${r.email}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              {r.email}
            </a>
            {" · "}
            {r.phone}
          </p>
          <p className="line-clamp-1 max-w-md text-xs text-muted-foreground">{descriptor(r)}</p>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      cell: (r) => <span className="text-foreground/80">{TYPE_LABEL[r.attendeeType]}</span>,
    },
    {
      key: "seats",
      header: "Seats",
      align: "center",
      cell: (r) => (
        <span className="font-mono text-sm tabular-nums text-foreground/80">{headcount(r)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <label className="inline-flex items-center">
          <span className="sr-only">Status for {r.fullName}</span>
          <select
            value={r.status}
            disabled={saving === r._id}
            onChange={(e) => setStatus(r, e.target.value as RegistrationStatus)}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-60",
              STATUS_CHIP[r.status],
            )}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-background text-foreground">
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ),
    },
    {
      key: "received",
      header: "Received",
      cell: (r) => (
        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          {formatDate(r.createdAt)}
          {r.checkedIn && <span className="ml-2 text-status-approved">Checked in</span>}
        </span>
      ),
    },
  ];

  return (
    <PageShell
      title="Event registrations"
      description="Influencers, media and audience members who asked to attend the IFFA awards night. Only admins can see this list."
      actions={
        <Button variant="outline" onClick={exportCsv} disabled={visible.length === 0}>
          <Download aria-hidden />
          Export CSV
        </Button>
      }
    >
      <section
        aria-label="Registration form link"
        className="mb-6 flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/[0.04] p-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Registration form link</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Send this to creators, press and guests. Anyone with it can register, without seeing
            this list.
          </p>
          <p className="mt-2 select-all break-all font-mono text-sm text-primary">{formUrl}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" onClick={copyLink}>
            <Copy aria-hidden />
            Copy link
          </Button>
          <Button variant="outline" asChild>
            <a href={emailHref}>
              <Mail aria-hidden />
              Email link
            </a>
          </Button>
          <Button variant="ghost" asChild>
            <a href="/attend" target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden />
              Open form
            </a>
          </Button>
        </div>
      </section>

      <dl className="mb-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
        {[
          { label: "Registrations", value: list.length },
          { label: "Awaiting review", value: counts.pending },
          { label: "Approved seats", value: counts.approvedSeats },
          { label: "Checked in", value: counts.checkedIn },
        ].map((s) => (
          <div key={s.label} className="bg-background px-4 py-3">
            <dt className="text-xs text-muted-foreground">{s.label}</dt>
            <dd className="mt-1 font-mono text-2xl tabular-nums text-foreground">
              {loading ? "—" : s.value}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div role="tablist" aria-label="Attendee type" className="flex flex-wrap gap-2">
          {TYPE_TABS.map((t) => {
            const active = typeFilter === t.value;
            const n = t.value === "all" ? list.length : counts.byType[t.value];
            return (
              <button
                key={t.value}
                role="tab"
                aria-selected={active}
                onClick={() => setTypeFilter(t.value)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                  active
                    ? "border-primary/60 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                <span className="ml-2 font-mono text-xs tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative block sm:w-64">
            <span className="sr-only">Search registrations</span>
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              id="registration-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, email, outlet, handle"
              className={cn(inputClass, "pl-9")}
            />
          </label>
          <label className="block sm:w-44">
            <span className="sr-only">Filter by status</span>
            <select
              id="registration-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className={inputClass}
            >
              <option value="all">Any status</option>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <RecordList
        items={visible}
        columns={columns}
        getKey={(r) => r._id}
        getStatus={(r) => EDGE[r.status]}
        loading={loading}
        error={error}
        empty={
          list.length === 0
            ? "No one has registered yet. Share the /attend-event link from the public site to start collecting registrations."
            : "No registrations match these filters."
        }
        actions={(r) => (
          <Button
            variant="rowAction"
            size="inline"
            onClick={() => router.push(`/admin/event-registrations/${r._id}`)}
          >
            Open
          </Button>
        )}
      />

      {!loading && !error && list.length > 0 && (
        <p className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground">
          Showing {visible.length} of {list.length}{" "}
          {list.length === 1 ? "registration" : "registrations"}. Export includes only what is
          shown.
        </p>
      )}
    </PageShell>
  );
}
