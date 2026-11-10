"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { deleteData, getData, patchData } from "@/lib/fetch-util";
import { useAuth } from "@/providers/auth-context";
import ConfirmDialog from "@/components/confirm-dialog";
import { inputClass, labelClass, textareaClass } from "@/components/form-section";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/talent-lab-status-badge";
import { toast } from "sonner";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  formatDate,
  requestError,
  type ApplicationStatus,
  type TalentLabApplication,
} from "@/lib/talent-lab";

const LIST_HREF = "/talent-lab/applications";
const orDash = (value?: string | null) => (value && value.trim() ? value : "—");

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className={labelClass}>{label}</p>
      <div className="mt-1 text-foreground">{children}</div>
    </div>
  );
}

function LongText({ label, value }: { label: string; value?: string }) {
  return (
    <Field label={label}>
      <p className="whitespace-pre-wrap text-sm">{orDash(value)}</p>
    </Field>
  );
}

function Group({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="space-y-6 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div>
        <h2 className="font-serif text-xl text-white">{title}</h2>
        {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export default function TalentLabApplicationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const isStaff = user?.role === "admin" || user?.role === "staff";
  const [item, setItem] = useState<TalentLabApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ApplicationStatus>("new");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // The site promises these answers are "never used in assessment", so they
  // stay hidden while staff review and are opened deliberately, one record at a time.
  const [showPrivate, setShowPrivate] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !isStaff) {
      router.replace("/");
      return;
    }
    if (!isAuthenticated || !params.id) return;
    let alive = true;
    (async () => {
      try {
        const res = await getData<{ success: boolean; data: TalentLabApplication }>(
          `/talent-lab/applications/${params.id}`,
        );
        if (!alive) return;
        setItem(res.data);
        setStatus(res.data.status);
        setNotes(res.data.staffNotes ?? "");
      } catch (e) {
        if (alive) setError(requestError(e).message || "Failed to load the application");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [params.id, isAuthenticated, isStaff, router]);

  if (isAuthenticated && !isStaff) return null;

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/3 rounded bg-border" />
          <div className="h-4 w-full rounded bg-border" />
          <div className="h-4 w-2/3 rounded bg-border" />
        </div>
      </main>
    );
  }

  if (error || !item) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <p className="mb-4 text-red-400">{error || "Application not found"}</p>
        <Link href={LIST_HREF} className="text-sm font-semibold tracking-wider text-primary hover:underline">
          ← Back to applications
        </Link>
      </main>
    );
  }

  const dirty = status !== item.status || notes !== (item.staffNotes ?? "");

  const save = async () => {
    setSaving(true);
    try {
      const res = await patchData<{ success: boolean; data: TalentLabApplication }>(
        `/talent-lab/applications/${item._id}`,
        { status, staffNotes: notes },
      );
      setItem({ ...item, ...res.data });
      toast.success("Application updated");
    } catch (e) {
      toast.error(requestError(e).message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await deleteData(`/talent-lab/applications/${item._id}`);
      router.push(LIST_HREF);
    } catch (e) {
      toast.error(requestError(e).message || "Failed to delete the application");
    }
  };

  const consents = item.consents;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href={LIST_HREF} className="mb-4 inline-block text-xs font-bold tracking-widest text-primary hover:underline">
            ← BACK TO APPLICATIONS
          </Link>
          <h1 className="mt-2 font-serif text-3xl text-white md:text-4xl">{item.fullName}</h1>
          <p className="mt-1 text-sm text-accent-foreground">
            <span className="font-mono">{item.reference}</span> · {item.program}
            {item.createdAt ? ` · received ${formatDate(item.createdAt)}` : ""}
          </p>
        </div>
        <button
          onClick={() => setConfirmingDelete(true)}
          className="self-start text-xs font-semibold text-status-rejected underline-offset-4 transition-colors hover:text-foreground hover:underline sm:self-center"
        >
          DELETE APPLICATION
        </button>
      </div>

      <div className="mb-6 space-y-4 rounded-lg border border-border bg-card/60 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-xl text-white">Review</h2>
          <StatusBadge status={item.status} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="status" className={labelClass}>
              Status
            </label>
            <select
              id="status"
              className={inputClass}
              value={status}
              onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
            >
              {APPLICATION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {APPLICATION_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="notes" className={labelClass}>
              Staff notes (never shown to the applicant)
            </label>
            <textarea
              id="notes"
              className={textareaClass}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <Button type="button" onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save review"}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card/60">
        <div className="space-y-6 p-6">
          <Group title="Contact">
            <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Field label="Email">
                <a href={`mailto:${item.email}`} className="text-primary hover:underline">
                  {item.email}
                </a>
              </Field>
              <Field label="Phone">{orDash(item.phone)}</Field>
              <Field label="Location">{orDash(item.location)}</Field>
              <Field label="Program">{item.program}</Field>
            </section>
          </Group>

          <Group title="Profile">
            <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Field label="Primary discipline">{item.primaryDiscipline}</Field>
              <Field label="Secondary discipline">{orDash(item.secondaryDiscipline)}</Field>
              <Field label="Career stage">{item.careerStage}</Field>
            </section>
            <LongText label="Biography" value={item.biography} />
            <LongText label="Career objective" value={item.careerObjective} />
          </Group>

          <Group title="Project & motivation">
            <LongText label="Project or portfolio" value={item.projectDescription} />
            <LongText label="Why this program" value={item.whyThisProgram} />
            <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <Field label="Portfolio link">
                <a href={item.portfolioLink} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">
                  {item.portfolioLink}
                </a>
              </Field>
              <Field label="Availability">{item.availability}</Field>
            </section>
            <LongText label="Previous programs" value={item.previousPrograms} />
          </Group>

          <Group
            title="Optional & private"
            note="Not for assessment. Applicants were promised these answers are seen only by program staff, never used in assessment and never made public. Open them only to arrange access support; don't copy them into emails, exports or shared documents."
          >
            {showPrivate ? (
              <>
                <LongText label="Access requirements" value={item.accessRequirements} />
                <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <Field label="First Nations">{orDash(item.firstNationsIdentification)}</Field>
                  <Field label="Regional or remote">{orDash(item.regionalRemote)}</Field>
                </section>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowPrivate(false)}>
                  Hide private answers
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setShowPrivate(true)}>
                Show private answers
              </Button>
            )}
          </Group>

          <Group title="Consents">
            <p className="text-sm text-foreground/80">
              Terms {consents?.terms ? "✓" : "✗"} · Code of conduct {consents?.conduct ? "✓" : "✗"} · Privacy{" "}
              {consents?.privacy ? "✓" : "✗"} · Media use {consents?.media ? "✓ agreed" : "not agreed"}
            </p>
          </Group>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        tone="danger"
        title="Delete this application?"
        description={
          <>
            <span className="text-foreground">{item.fullName}</span>&apos;s application ({item.reference}) will be
            removed. This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete application"
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          void remove();
        }}
      />
    </main>
  );
}
