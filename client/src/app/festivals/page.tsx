"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/providers/auth-context";
import { getData, postData, updateData, deleteData } from "@/lib/fetch-util";
import { Pencil, Trash2, Plus, Settings2, Eye, EyeOff } from "lucide-react";

/**
 * Festivals index for the CMS.
 *
 * "New festival" creates a draft record immediately and opens its editor,
 * rather than collecting everything in one form. That ordering is deliberate:
 * artwork uploads are addressed to a festival id so the server can resolve the
 * S3 folder itself, which is only possible once the record exists.
 */

type Screening = { _id?: string; title: string; date: string };

type Festival = {
  _id: string;
  slug: string;
  edition: string;
  name: string;
  tagline?: string;
  startDate: string;
  endDate: string;
  isPublished?: boolean;
  screenings: Screening[];
};

type ListResponse = { success: boolean; data: Festival[]; message?: string };
type CreateResponse = { success: boolean; data: Festival; message?: string };

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-08-07" -> "August 2026". Split by hand: see the note in festival-utils. */
const monthLabel = (iso: string) => {
  const [year, month] = iso.split("-").map(Number);
  return MONTHS[month - 1] ? `${MONTHS[month - 1]} ${year}` : "Undated";
};

const dateRange = (start: string, end: string) => {
  const [, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  if (sm === em) return `${sd}–${ed} ${MONTHS[em - 1]} ${ey}`;
  return `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]} ${ey}`;
};

const errorMessage = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

/** Today, as an ISO date, for seeding a new festival's dates. */
const todayIso = () => new Date().toISOString().slice(0, 10);

export default function FestivalsAdminPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user?.role !== "admin" && user?.role !== "staff") {
      router.replace("/");
    }
  }, [isAuthenticated, user, router]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getData<ListResponse>("/festivals/manage");
      setFestivals(res?.data ?? []);
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to load festivals"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Grouped the way the public page renders them, so staff see the same
  // month -> festival shape a visitor does.
  const grouped = useMemo(() => {
    const byMonth = new Map<string, Festival[]>();
    for (const festival of festivals) {
      const key = festival.startDate.slice(0, 7);
      const list = byMonth.get(key);
      if (list) list.push(festival);
      else byMonth.set(key, [festival]);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, items]) => ({ key, label: monthLabel(`${key}-01`), items }));
  }, [festivals]);

  const handleCreate = async () => {
    try {
      setCreating(true);
      setError(null);
      const today = todayIso();
      const res = await postData<CreateResponse>("/festivals", {
        name: `Untitled festival ${new Date().toLocaleDateString()}`,
        startDate: today,
        endDate: today,
        edition: "01",
        isPublished: false,
      });
      if (!res?.data?._id) throw new Error(res?.message || "Could not create festival");
      router.push(`/festivals/${res.data._id}`);
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to create festival"));
      setCreating(false);
    }
  };

  const togglePublished = async (festival: Festival) => {
    try {
      setError(null);
      await updateData(`/festivals/${festival._id}`, {
        isPublished: !festival.isPublished,
      });
      setSuccess(
        festival.isPublished
          ? `"${festival.name}" is now hidden from the website.`
          : `"${festival.name}" is now live on the website.`,
      );
      await load();
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to update festival"));
    }
  };

  const handleDelete = async (festival: Festival) => {
    // Spelled out because the S3 half is not recoverable from the CMS.
    const confirmed = window.confirm(
      `Delete "${festival.name}"?\n\n` +
        `This removes the festival, its ${festival.screenings.length} screening(s), ` +
        `and every image uploaded for it from storage. This cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      setError(null);
      await deleteData(`/festivals/${festival._id}`);
      setSuccess(`"${festival.name}" deleted.`);
      await load();
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to delete festival"));
    }
  };

  if (!isAuthenticated) return null;
  if (isAuthenticated && user?.role !== "admin" && user?.role !== "staff") return null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="mb-2 font-serif text-3xl text-white md:text-4xl">Festivals</h1>
          <p className="text-sm text-accent-foreground">
            Manage the festivals and screenings shown on the public Festivals page.
            Only published festivals appear on the website.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/festivals/settings"
            className="inline-flex items-center gap-2 rounded border border-border px-4 py-2 text-xs font-bold tracking-widest text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Settings2 size={14} /> PAGE SETTINGS
          </Link>
          <button
            onClick={() => void handleCreate()}
            disabled={creating}
            className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-xs font-bold tracking-widest text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Plus size={14} /> {creating ? "CREATING..." : "NEW FESTIVAL"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded border border-red-400/30 bg-red-400/10 px-4 py-2 text-sm text-red-400">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-4 rounded border border-green-400/30 bg-green-400/10 px-4 py-2 text-sm text-green-400">
          {success}
        </p>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="h-20 animate-pulse rounded bg-card/60" />
          <div className="h-20 animate-pulse rounded bg-card/60" />
        </div>
      ) : festivals.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No festivals yet. Use “New Festival” to create the first one.
        </p>
      ) : (
        <div className="space-y-10">
          {grouped.map((group) => (
            <section key={group.key}>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                {group.label} ({group.items.length})
              </h2>
              <div className="space-y-2">
                {group.items.map((festival) => (
                  <div
                    key={festival._id}
                    className="flex items-center gap-4 rounded border border-border bg-card/60 p-3"
                  >
                    <span className="shrink-0 rounded border border-border px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {festival.edition}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">
                        {festival.name}
                        {!festival.isPublished && (
                          <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            Draft
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {dateRange(festival.startDate, festival.endDate)} ·{" "}
                        {festival.screenings.length} screening
                        {festival.screenings.length === 1 ? "" : "s"} · /{festival.slug}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => void togglePublished(festival)}
                        className="p-1.5 text-muted-foreground hover:text-primary"
                        aria-label={
                          festival.isPublished
                            ? `Hide ${festival.name} from the website`
                            : `Publish ${festival.name} to the website`
                        }
                        title={festival.isPublished ? "Published — click to hide" : "Draft — click to publish"}
                      >
                        {festival.isPublished ? <Eye size={15} /> : <EyeOff size={15} />}
                      </button>
                      <Link
                        href={`/festivals/${festival._id}`}
                        className="p-1.5 text-muted-foreground hover:text-primary"
                        aria-label={`Edit ${festival.name}`}
                      >
                        <Pencil size={15} />
                      </Link>
                      <button
                        onClick={() => void handleDelete(festival)}
                        className="p-1.5 text-muted-foreground hover:text-red-400"
                        aria-label={`Delete ${festival.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
