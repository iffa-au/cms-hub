"use client";

import { useEffect, useState, type ReactNode } from "react";
import { getData, deleteData } from "@/lib/fetch-util";
import { useAuth } from "@/providers/auth-context";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ConfirmDialog from "@/components/confirm-dialog";
import { labelClass } from "@/components/form-section";
import {
  DELIVERABLE_LABELS,
  PRODUCTION_STATUS_LABELS,
  RIGHTS_LABELS,
  ROLE_LABELS,
  TERRITORY_LABELS,
  formatDate,
  labelOf,
  labelsOf,
  requestError,
  type DistributionEnquiryItem,
} from "@/lib/distribution-enquiry";

const LABEL = labelClass;
const VALUE = "text-foreground mt-1";
const LIST_HREF = "/admin/distribution-enquiry";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className={LABEL}>{label}</p>
      <div className={VALUE}>{children}</div>
    </div>
  );
}

function ExternalLink({ href }: { href?: string }) {
  if (!href) return <>{"—"}</>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline break-all"
    >
      {href}
    </a>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-6 border-t border-border pt-6 first:border-t-0 first:pt-0">
      <h2 className="font-serif text-xl text-white">{title}</h2>
      {children}
    </section>
  );
}

const orDash = (value?: string | null) => (value && value.trim() ? value : "—");
const joinOrDash = (values: string[]) => (values.length ? values.join(", ") : "—");

export default function DistributionEnquiryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [item, setItem] = useState<DistributionEnquiryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "admin") {
      router.replace("/");
      return;
    }
    const id = params.id;
    if (!id) return;
    let isMounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getData<{ success: boolean; data: DistributionEnquiryItem }>(
          `/distribution-enquiries/${id}`
        );
        if (!isMounted) return;
        if (res?.success && res.data) {
          setItem(res.data);
        } else {
          setError("Enquiry not found");
        }
      } catch (e) {
        if (!isMounted) return;
        const { status, message } = requestError(e);
        setError(status === 404 ? "Enquiry not found" : message || "Failed to load enquiry");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [params.id, isAuthenticated, user?.role, router]);

  if (!isAuthenticated || user?.role !== "admin") return null;

  if (loading) {
    return (
      <main className="mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 max-w-3xl">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-border rounded w-1/3" />
          <div className="h-4 bg-border rounded w-full" />
          <div className="h-4 bg-border rounded w-2/3" />
        </div>
      </main>
    );
  }

  if (error || !item) {
    return (
      <main className="mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 max-w-3xl">
        <p className="text-red-400 mb-4">{error || "Enquiry not found"}</p>
        <Link
          href={LIST_HREF}
          className="text-primary hover:underline text-sm font-semibold tracking-wider"
        >
          ← Back to Distribution Enquiry list
        </Link>
      </main>
    );
  }

  const handleDelete = async () => {
    try {
      await deleteData(`/distribution-enquiries/${item._id}`);
      router.push(LIST_HREF);
    } catch (e) {
      setError(requestError(e).message || "Failed to delete enquiry");
    }
  };

  const genres = (item.genreIds ?? []).map((g) => g?.name).filter(Boolean) as string[];

  return (
    <main className="mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 max-w-3xl">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href={LIST_HREF}
            className="text-primary hover:underline text-xs font-bold tracking-widest mb-4 inline-block"
          >
            ← BACK TO LIST
          </Link>
          <h1 className="font-serif text-3xl md:text-4xl text-white mt-2">
            Distribution Enquiry
          </h1>
          <p className="text-accent-foreground text-sm mt-1">{item.title}</p>
        </div>
        <div className="flex items-center gap-5 self-start sm:self-center">
          <button
            onClick={() => setConfirmingDelete(true)}
            className="text-xs font-semibold text-status-rejected underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            DELETE ENQUIRY
          </button>
        </div>
      </div>

      <div className="bg-card/60 rounded-lg border border-border overflow-hidden">
        <div className="p-6 space-y-6">
          <Group title="Contact">
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Field label="Name">
                <strong>{item.name}</strong> · {labelOf(ROLE_LABELS, item.role)}
              </Field>
              <Field label="Email">
                <a href={`mailto:${item.email}`} className="text-primary hover:underline">
                  {item.email}
                </a>
              </Field>
              <Field label="Phone">{orDash(item.phone)}</Field>
              <Field label="Company / production house">{orDash(item.company)}</Field>
              <Field label="Website">
                <ExternalLink href={item.website} />
              </Field>
            </section>
          </Group>

          <Group title="The film">
            <Field label="Synopsis">
              <p className="whitespace-pre-wrap text-sm">{orDash(item.synopsis)}</p>
            </Field>
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Field label="Content type">{item.contentType?.name ?? "—"}</Field>
              <Field label="Production status">
                {labelOf(PRODUCTION_STATUS_LABELS, item.productionStatus)}
              </Field>
              <Field label="Genres">{joinOrDash(genres)}</Field>
              <Field label="Country of origin">{item.country?.name ?? "—"}</Field>
              <Field label="Original language">{item.language?.name ?? "—"}</Field>
              <Field label="Runtime">
                {item.runtimeMinutes ? `${item.runtimeMinutes} min` : "—"}
              </Field>
              <Field label="Year of completion">{item.year || "—"}</Field>
            </section>
            <Field label="Festivals & awards">
              <p className="whitespace-pre-wrap text-sm">{orDash(item.festivals)}</p>
            </Field>
          </Group>

          <Group title="Distribution">
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Field label="Rights available">
                {joinOrDash(labelsOf(RIGHTS_LABELS, item.rights))}
              </Field>
              <Field label="Territories sought">
                {joinOrDash(labelsOf(TERRITORY_LABELS, item.territories))}
              </Field>
              <Field label="Deliverables ready">
                {joinOrDash(labelsOf(DELIVERABLE_LABELS, item.deliverables))}
              </Field>
            </section>
            <Field label="Territories already sold">
              <p className="whitespace-pre-wrap text-sm">{orDash(item.territoriesSold)}</p>
            </Field>
          </Group>

          <Group title="Screening material">
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Field label="Screener link">
                <ExternalLink href={item.screenerUrl} />
              </Field>
              <Field label="Screener password">
                {item.screenerPassword ? (
                  <code className="rounded border border-border bg-background px-2 py-1 font-mono text-sm">
                    {item.screenerPassword}
                  </code>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Trailer link">
                <ExternalLink href={item.trailerUrl} />
              </Field>
            </section>
            <Field label="Anything else">
              <p className="whitespace-pre-wrap text-sm">{orDash(item.notes)}</p>
            </Field>
          </Group>

          <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-border">
            <div>
              <p className={LABEL}>Rights confirmed</p>
              <p className="text-muted-foreground text-sm mt-1">
                {item.rightsConfirmed ? "Yes — submitter confirmed they can represent the rights" : "No"}
              </p>
            </div>
            <div>
              <p className={LABEL}>Submitted</p>
              <p className="text-muted-foreground text-sm mt-1">
                {item.createdAt ? formatDate(item.createdAt) : "—"}
              </p>
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        tone="danger"
        title="Delete this enquiry?"
        description={
          <>
            <span className="text-foreground">{item.title}</span> from {item.name} will be
            removed. This can&apos;t be undone.
          </>
        }
        confirmLabel="Delete enquiry"
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          void handleDelete();
        }}
      />
    </main>
  );
}
