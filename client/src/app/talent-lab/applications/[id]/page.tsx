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
  APPLY_AVAILABILITY,
  APPLY_CAREER_STAGES,
  APPLY_DISCIPLINES,
  QUICK_ACTIONS,
  formatDate,
  requestError,
  type ApplicationStatus,
  type TalentLabApplication,
} from "@/lib/talent-lab";
import { applicationPdfFileName, buildApplicationPdf } from "@/lib/talent-lab-application-pdf";

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

/** The contact and profile fields staff may correct. Mirrors the backend's EDITABLE_APPLICATION_FIELDS. */
const EDITABLE = [
  "fullName",
  "email",
  "phone",
  "location",
  "program",
  "primaryDiscipline",
  "secondaryDiscipline",
  "careerStage",
  "portfolioLink",
  "availability",
] as const;
type EditKey = (typeof EDITABLE)[number];
type EditValues = Record<EditKey, string>;

const pickEditable = (a: TalentLabApplication): EditValues =>
  Object.fromEntries(EDITABLE.map((k) => [k, String(a[k] ?? "")])) as EditValues;

const headerButton =
  "rounded-lg border px-4 py-2 text-xs font-bold tracking-widest transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/** A select that keeps a stored value visible even if it is no longer an option. */
function OptionSelect({
  id,
  value,
  options,
  onChange,
  allowEmpty,
}: {
  id: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  allowEmpty?: boolean;
}) {
  const all = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      {allowEmpty && <option value="">None</option>}
      {all.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
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
  const [quickBusy, setQuickBusy] = useState<ApplicationStatus | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<EditValues | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [programNames, setProgramNames] = useState<string[]>([]);
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
    // Program names for the edit form's suggestions. Optional: before programs
    // are managed in the CMS this list is empty and the field stays free text.
    (async () => {
      try {
        const res = await getData<{ data?: { name?: string }[] }>("/talent-lab/programs/manage");
        if (alive) setProgramNames((res.data ?? []).map((p) => String(p.name ?? "")).filter(Boolean));
      } catch {
        // ignore
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

  const applyUpdate = (data: TalentLabApplication) => {
    const next = { ...item, ...data };
    setItem(next);
    setStatus(next.status);
    setNotes(next.staffNotes ?? "");
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await patchData<{ success: boolean; data: TalentLabApplication }>(
        `/talent-lab/applications/${item._id}`,
        { status, staffNotes: notes },
      );
      applyUpdate(res.data);
      toast.success("Application updated");
    } catch (e) {
      toast.error(requestError(e).message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  /** One-click status change. Unsaved notes go with it rather than being lost. */
  const quick = async (next: ApplicationStatus, done: string) => {
    setQuickBusy(next);
    try {
      const res = await patchData<{ success: boolean; data: TalentLabApplication }>(
        `/talent-lab/applications/${item._id}`,
        { status: next, staffNotes: notes },
      );
      applyUpdate(res.data);
      toast.success(`Application ${done}`);
    } catch (e) {
      toast.error(requestError(e).message || "Failed to update the status");
    } finally {
      setQuickBusy(null);
    }
  };

  const startEdit = () => {
    setEdit(pickEditable(item));
    setEditError(null);
    setEditing(true);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit) return;
    const original = pickEditable(item);
    const changed = Object.fromEntries(EDITABLE.filter((k) => edit[k] !== original[k]).map((k) => [k, edit[k]]));
    if (!Object.keys(changed).length) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      const res = await patchData<{ success: boolean; data: TalentLabApplication }>(
        `/talent-lab/applications/${item._id}`,
        changed,
      );
      applyUpdate(res.data);
      setEditing(false);
      toast.success("Applicant details saved");
    } catch (err) {
      setEditError(requestError(err).message || "Couldn't save the changes");
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      buildApplicationPdf(doc, item);
      doc.save(applicationPdfFileName(item));
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : "Failed to generate the PDF");
    } finally {
      setDownloading(false);
    }
  };

  const remove = async () => {
    try {
      await deleteData(`/talent-lab/applications/${item._id}`);
      toast.success("Application deleted");
      router.push(LIST_HREF);
    } catch (e) {
      toast.error(requestError(e).message || "Failed to delete the application");
    }
  };

  const consents = item.consents;
  const setField = (key: EditKey, value: string) => setEdit((v) => (v ? { ...v, [key]: value } : v));
  const textInput = (key: EditKey, label: string, type = "text") => (
    <div>
      <label htmlFor={`edit-${key}`} className={labelClass}>
        {label}
      </label>
      <input
        id={`edit-${key}`}
        type={type}
        className={inputClass}
        value={edit?.[key] ?? ""}
        onChange={(e) => setField(key, e.target.value)}
        required
      />
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <Link href={LIST_HREF} className="mb-4 inline-block text-xs font-bold tracking-widest text-primary hover:underline">
        ← BACK TO APPLICATIONS
      </Link>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="mt-2 font-serif text-3xl text-white md:text-4xl">{item.fullName}</h1>
          <p className="mt-1 text-sm text-accent-foreground">
            <span className="font-mono">{item.reference}</span> · {item.program}
            {item.createdAt ? ` · received ${formatDate(item.createdAt)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={startEdit}
            disabled={editing}
            className={`${headerButton} border-border text-foreground hover:border-primary`}
          >
            EDIT
          </button>
          <button
            type="button"
            onClick={() => void downloadPdf()}
            disabled={downloading}
            className={`${headerButton} border-primary bg-primary text-primary-foreground hover:opacity-90`}
          >
            {downloading ? "DOWNLOADING…" : "DOWNLOAD PDF"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className={`${headerButton} border-red-500 text-red-500 hover:bg-red-500 hover:text-white`}
          >
            DELETE
          </button>
        </div>
      </div>

      <div className="mb-6 space-y-5 rounded-lg border border-border bg-card/60 p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-xl text-white">Review</h2>
          <StatusBadge status={item.status} />
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick status">
          {QUICK_ACTIONS.map((a) => (
            <Button
              key={a.status}
              type="button"
              size="sm"
              variant={item.status === a.status ? "default" : "outline"}
              disabled={quickBusy !== null || item.status === a.status}
              onClick={() => void quick(a.status, a.done)}
            >
              {quickBusy === a.status ? "Saving…" : a.label}
            </Button>
          ))}
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
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={save} disabled={!dirty || saving}>
            {saving && !editing ? "Saving…" : "Save review"}
          </Button>
          <a
            href={`mailto:${item.email}?subject=${encodeURIComponent(`IFFA Talent Lab — your application ${item.reference}`)}`}
            className="text-sm font-semibold text-primary underline-offset-4 hover:underline"
          >
            Email applicant
          </a>
        </div>
      </div>

      {editing && edit && (
        <form onSubmit={saveEdit} className="mb-6 space-y-5 rounded-lg border border-primary/40 bg-card/60 p-6">
          <div>
            <h2 className="font-serif text-xl text-white">Edit applicant details</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              For corrections such as a mistyped email or the wrong program. The applicant&apos;s written answers,
              consents and private answers can&apos;t be changed.
            </p>
          </div>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {textInput("fullName", "Full name")}
            {textInput("email", "Email", "email")}
            {textInput("phone", "Phone", "tel")}
            {textInput("location", "Location")}
            <div className="sm:col-span-2">
              <label htmlFor="edit-program" className={labelClass}>
                Program
              </label>
              {programNames.length ? (
                <OptionSelect
                  id="edit-program"
                  value={edit.program}
                  options={programNames}
                  onChange={(v) => setField("program", v)}
                />
              ) : (
                <input
                  id="edit-program"
                  className={inputClass}
                  value={edit.program}
                  onChange={(e) => setField("program", e.target.value)}
                  required
                />
              )}
            </div>
            <div>
              <label htmlFor="edit-primaryDiscipline" className={labelClass}>
                Primary discipline
              </label>
              <OptionSelect
                id="edit-primaryDiscipline"
                value={edit.primaryDiscipline}
                options={APPLY_DISCIPLINES}
                onChange={(v) => setField("primaryDiscipline", v)}
              />
            </div>
            <div>
              <label htmlFor="edit-secondaryDiscipline" className={labelClass}>
                Secondary discipline
              </label>
              <OptionSelect
                id="edit-secondaryDiscipline"
                value={edit.secondaryDiscipline}
                options={APPLY_DISCIPLINES}
                onChange={(v) => setField("secondaryDiscipline", v)}
                allowEmpty
              />
            </div>
            <div>
              <label htmlFor="edit-careerStage" className={labelClass}>
                Career stage
              </label>
              <OptionSelect
                id="edit-careerStage"
                value={edit.careerStage}
                options={APPLY_CAREER_STAGES}
                onChange={(v) => setField("careerStage", v)}
              />
            </div>
            <div>
              <label htmlFor="edit-availability" className={labelClass}>
                Availability
              </label>
              <OptionSelect
                id="edit-availability"
                value={edit.availability}
                options={APPLY_AVAILABILITY}
                onChange={(v) => setField("availability", v)}
              />
            </div>
            <div className="sm:col-span-2">{textInput("portfolioLink", "Portfolio link", "url")}</div>
          </section>
          {editError && <p className="text-sm text-red-400">{editError}</p>}
          <div className="flex gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save details"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      )}

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
