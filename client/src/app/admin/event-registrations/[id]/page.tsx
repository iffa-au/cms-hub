"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import ConfirmDialog from "@/components/confirm-dialog";
import { inputClass, labelClass, textareaClass } from "@/components/form-section";
import { Button } from "@/components/ui/button";
import { deleteData, getData, patchData } from "@/lib/fetch-util";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-context";
import {
  MEDIA_TYPE_LABEL,
  PASS_OPTIONS,
  PLATFORM_LABEL,
  STATUS_CHIP,
  STATUS_OPTIONS,
  TYPE_LABEL,
  headcount,
  type EventRegistration,
  type PassType,
  type RegistrationStatus,
} from "@/lib/event-registration";

type AdminFields = {
  status: RegistrationStatus;
  passType: PassType;
  seatOrTable: string;
  adminNotes: string;
  checkedIn: boolean;
};

const pickAdmin = (r: EventRegistration): AdminFields => ({
  status: r.status,
  passType: r.passType ?? "",
  seatOrTable: r.seatOrTable ?? "",
  adminNotes: r.adminNotes ?? "",
  checkedIn: r.checkedIn,
});

const formatDateTime = (d?: string | null) =>
  d
    ? new Date(d).toLocaleString("en-AU", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

function Row({ label, children }: { label: string; children: ReactNode }) {
  if (children === undefined || children === null || children === "") return null;
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className={labelClass}>{label}</dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border">
      <h2 className="border-b border-border px-5 py-3 text-sm font-semibold text-foreground">
        {title}
      </h2>
      <dl className="divide-y divide-border px-5">{children}</dl>
    </section>
  );
}

function ExternalLink({ href }: { href: string }) {
  const url = /^https?:\/\//i.test(href) ? href : `https://${href}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline-offset-4 hover:underline"
    >
      {href}
    </a>
  );
}

export default function EventRegistrationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [item, setItem] = useState<EventRegistration | null>(null);
  const [form, setForm] = useState<AdminFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      router.replace("/");
      return;
    }
    if (!params.id) return;
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getData<{ success: boolean; data: EventRegistration }>(
          `/event-registrations/${params.id}`,
        );
        if (!alive) return;
        if (res?.data) {
          setItem(res.data);
          setForm(pickAdmin(res.data));
        } else setError("Registration not found");
      } catch (e: any) {
        if (!alive) return;
        setError(
          e?.response?.status === 404
            ? "Registration not found"
            : e?.message || "Couldn't load this registration",
        );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [params.id, isAuthenticated, user?.role, router]);

  if (!isAuthenticated || user?.role !== "admin") return null;

  const shell = "mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8";

  if (loading) {
    return (
      <main className={shell}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/3 rounded bg-border" />
          <div className="h-4 w-full rounded bg-border" />
          <div className="h-4 w-2/3 rounded bg-border" />
        </div>
      </main>
    );
  }

  if (error || !item || !form) {
    return (
      <main className={shell}>
        <p className="mb-4 text-status-rejected">{error || "Registration not found"}</p>
        <Link href="/admin/event-registrations" className="text-sm text-primary hover:underline">
          ← Back to event registrations
        </Link>
      </main>
    );
  }

  const dirty = JSON.stringify(form) !== JSON.stringify(pickAdmin(item));

  const save = async () => {
    setSaving(true);
    try {
      const res = await patchData<{ success: boolean; data: EventRegistration }>(
        `/event-registrations/${item._id}`,
        form,
      );
      if (res?.data) {
        setItem(res.data);
        setForm(pickAdmin(res.data));
      }
      toast.success("Saved");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await deleteData(`/event-registrations/${item._id}`);
      toast.success("Registration deleted");
      router.push("/admin/event-registrations");
    } catch (e: any) {
      toast.error(e?.message || "Couldn't delete");
    }
  };

  return (
    <main className={shell}>
      <Link
        href="/admin/event-registrations"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Event registrations
      </Link>

      <header className="mb-8 mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {TYPE_LABEL[item.attendeeType]} · received {formatDateTime(item.createdAt)}
          </p>
          <h1 className="mt-1 text-balance font-serif text-3xl text-foreground">
            {item.fullName}
          </h1>
        </div>
        <span
          className={cn(
            "inline-flex w-fit items-center rounded-full border px-3 py-1 text-xs font-medium",
            STATUS_CHIP[item.status],
          )}
        >
          {STATUS_OPTIONS.find((o) => o.value === item.status)?.label}
          {item.checkedIn && " · checked in"}
        </span>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Section title="Contact">
            <Row label="Email">
              <a href={`mailto:${item.email}`} className="text-primary hover:underline">
                {item.email}
              </a>
            </Row>
            <Row label="Phone">{item.phone}</Row>
            <Row label="Seats requested">{headcount(item)}</Row>
          </Section>

          {item.attendeeType === "influencer" && (
            <Section title="Social presence">
              <Row label="Platform">
                {item.socialPlatform ? PLATFORM_LABEL[item.socialPlatform] ?? item.socialPlatform : ""}
              </Row>
              <Row label="Username / link">
                {item.socialHandle &&
                  (/[./]/.test(item.socialHandle) ? (
                    <ExternalLink href={item.socialHandle} />
                  ) : (
                    item.socialHandle
                  ))}
              </Row>
              <Row label="Content type">{item.contentNiche}</Row>
            </Section>
          )}

          {item.attendeeType === "media" && item.media && (
            <Section title="Media outlet">
              <Row label="Outlet">{item.media.outlet}</Row>
              <Row label="Media type">
                {item.media.mediaType ? MEDIA_TYPE_LABEL[item.media.mediaType] : ""}
              </Row>
              <Row label="Role / title">{item.media.roleTitle}</Row>
              <Row label="Website">
                {item.media.outletWebsite ? <ExternalLink href={item.media.outletWebsite} /> : ""}
              </Row>
              <Row label="Press ID">{item.media.pressId}</Row>
              <Row label="Editor / desk">{item.media.editorName}</Row>
              <Row label="Editor email">
                {item.media.editorEmail ? (
                  <a
                    href={`mailto:${item.media.editorEmail}`}
                    className="text-primary hover:underline"
                  >
                    {item.media.editorEmail}
                  </a>
                ) : (
                  ""
                )}
              </Row>
              <Row label="Editor phone">{item.media.editorPhone}</Row>
              <Row label="Crew attending">{item.media.crewCount || ""}</Row>
              <Row label="Coverage plan">
                <span className="whitespace-pre-line">{item.media.coveragePlan}</span>
              </Row>
            </Section>
          )}

          {item.attendeeType === "audience" && (
            <Section title="Party">
              <Row label="Guests">{item.guests ? `+${item.guests}` : "None"}</Row>
            </Section>
          )}

          {(item.accessibilityNeeds || item.comments) && (
            <Section title="From the registrant">
              <Row label="Access needs">{item.accessibilityNeeds}</Row>
              <Row label="Comments">
                <span className="whitespace-pre-line">{item.comments}</span>
              </Row>
            </Section>
          )}
        </div>

        {/* Admin-only fields. The public form can't set these and never sees them. */}
        <aside className="h-fit rounded-lg border border-primary/30 bg-primary/[0.03] p-5 lg:sticky lg:top-28">
          <h2 className="text-sm font-semibold text-foreground">Admin only</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            The registrant never sees these fields.
          </p>

          <div className="mt-5 space-y-4">
            <label className="block space-y-1.5">
              <span className={labelClass}>Status</span>
              <select
                id="admin-status"
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as RegistrationStatus })
                }
                className={inputClass}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className={labelClass}>Pass type</span>
              <select
                id="admin-pass"
                value={form.passType}
                onChange={(e) => setForm({ ...form, passType: e.target.value as PassType })}
                className={inputClass}
              >
                {PASS_OPTIONS.map((o) => (
                  <option key={o.value || "none"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className={labelClass}>Seat / table</span>
              <input
                id="admin-seat"
                value={form.seatOrTable}
                maxLength={80}
                onChange={(e) => setForm({ ...form, seatOrTable: e.target.value })}
                placeholder="e.g. Table 4"
                className={inputClass}
              />
            </label>

            <label className="block space-y-1.5">
              <span className={labelClass}>Internal notes</span>
              <textarea
                id="admin-notes"
                value={form.adminNotes}
                maxLength={2000}
                onChange={(e) => setForm({ ...form, adminNotes: e.target.value })}
                placeholder="Who approved, follow-ups, dietary needs…"
                className={textareaClass}
              />
            </label>

            <label className="flex cursor-pointer items-center gap-3 rounded border border-border px-3 py-2.5 text-sm text-foreground">
              <input
                id="admin-checked-in"
                type="checkbox"
                checked={form.checkedIn}
                onChange={(e) => setForm({ ...form, checkedIn: e.target.checked })}
                className="size-4 accent-[var(--primary)]"
              />
              Checked in at the door
            </label>
            {item.checkedInAt && (
              <p className="-mt-2 text-xs text-muted-foreground">
                Checked in {formatDateTime(item.checkedInAt)}
              </p>
            )}

            <Button onClick={save} disabled={!dirty || saving} className="w-full">
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </Button>
          </div>

          <div className="mt-6 border-t border-border pt-4">
            <Button
              variant="rowDanger"
              size="inline"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete registration
            </Button>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        tone="danger"
        title="Delete this registration?"
        description={
          <>
            <span className="text-foreground">{item.fullName}</span>&apos;s registration will be
            removed for good. This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete registration"
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          void remove();
        }}
      />
    </main>
  );
}
