"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/providers/auth-context";
import { getData, postData, updateData, deleteData } from "@/lib/fetch-util";
import { Pencil, Trash2, Settings2, Eye, EyeOff, Plus } from "lucide-react";

/**
 * The festival calendar.
 *
 * IFFA runs one festival a year, and the backend enforces that with a unique
 * index on `year`. This page is the same rule made visible: it lists *years*,
 * not festivals. Each year is either set up — in which case it opens for
 * editing — or empty, in which case setting it up creates that year's festival
 * and nothing else.
 *
 * There is deliberately no free-form "new festival" button. It could only ever
 * produce a second festival in a year that already has one, which the API
 * refuses, so the affordance was a trap. Creating happens by opening the year
 * you want, and a year that is already taken has no create action at all.
 *
 * Creation still writes the record before opening the editor. That ordering is
 * load-bearing: artwork uploads are addressed to a festival id so the server
 * can resolve the S3 folder itself, which is only possible once the record
 * exists.
 */

type Screening = {
  _id?: string;
  title: string;
  startDate?: string;
  films?: { title: string }[];
};

/**
 * Films across every session.
 *
 * A screening count stopped being a film count when a session gained a
 * lineup — a three-session festival can hold twenty films — so both are
 * shown. `films` is optional because a festival that has not been through
 * `migrate-screenings-to-sessions.ts` yet has no such array; those rows were
 * one film each, which is what the fallback counts.
 */
const countFilms = (screenings: Screening[]): number =>
  screenings.reduce(
    (total, screening) => total + (screening.films?.length ?? 1),
    0,
  );

type Festival = {
  _id: string;
  slug: string;
  year?: number;
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

/** Split by hand rather than via `new Date` — see the note in festival-utils. */
const dateRange = (start: string, end: string) => {
  const [, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  if (sm === em) return `${sd}–${ed} ${MONTHS[em - 1]} ${ey}`;
  return `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]} ${ey}`;
};

/**
 * A festival's year. Falls back to its start date for records saved before
 * `year` was stored, so no festival can fall out of the calendar.
 */
const festivalYear = (festival: Festival): number =>
  Number(festival.year) || Number(festival.startDate.slice(0, 4)) || 0;

const errorMessage = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

/** One row of the calendar: a year, and the festival in it if there is one. */
type YearSlot = { year: number; festival: Festival | null };

export default function FestivalsAdminPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [festivals, setFestivals] = useState<Festival[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingYear, setCreatingYear] = useState<number | null>(null);
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

  /**
   * Every year worth showing: this year, next year, and every year that
   * already holds a festival.
   *
   * The two forward years are always present so there is somewhere to set the
   * next festival up. Past years appear only when they have something in them
   * — offering to create the 2019 festival would be offering to invent one.
   */
  const slots = useMemo<YearSlot[]>(() => {
    const byYear = new Map<number, Festival>();
    for (const festival of festivals) byYear.set(festivalYear(festival), festival);

    const thisYear = new Date().getFullYear();
    const years = new Set<number>([thisYear, thisYear + 1, ...byYear.keys()]);

    return [...years]
      .sort((a, b) => b - a)
      .map((year) => ({ year, festival: byYear.get(year) ?? null }));
  }, [festivals]);

  const handleCreate = async (year: number) => {
    try {
      setCreatingYear(year);
      setError(null);
      const res = await postData<CreateResponse>("/festivals", {
        name: `IFFA ${year}`,
        // Mid-October is when the festival has run. Only a starting point —
        // the editor opens on the next screen.
        startDate: `${year}-10-14`,
        endDate: `${year}-10-17`,
        isPublished: false,
      });
      if (!res?.data?._id) throw new Error(res?.message || "Could not create festival");
      router.push(`/festivals/${res.data._id}`);
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to create festival"));
      setCreatingYear(null);
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
        `${countFilms(festival.screenings)} film(s), and every image uploaded for it ` +
        `from storage. This cannot be undone.`,
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
          <h1 className="mb-2 font-serif text-3xl text-white md:text-4xl">Festival</h1>
          <p className="max-w-2xl text-sm text-accent-foreground">
            IFFA runs one festival a year, so this is a calendar rather than a
            list. The published festival for the current or next year is the one
            the website is built around; earlier years become its archive.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href="/festivals/settings"
            className="inline-flex items-center gap-2 rounded border border-border px-4 py-2 text-xs font-bold tracking-widest text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Settings2 size={14} /> PAGE SETTINGS
          </Link>
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
      ) : (
        <div className="space-y-2">
          {slots.map(({ year, festival }) => (
            <div
              key={year}
              className="flex flex-col gap-3 rounded border border-border bg-card/60 p-4 sm:flex-row sm:items-center sm:gap-5"
            >
              <span className="shrink-0 font-serif text-2xl text-white sm:w-20">
                {year}
              </span>

              {festival ? (
                <>
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
                      {festival.screenings.length === 1 ? "" : "s"} ·{" "}
                      {countFilms(festival.screenings)} film
                      {countFilms(festival.screenings) === 1 ? "" : "s"} · /
                      {festival.slug}
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
                      title={
                        festival.isPublished
                          ? "Published — click to hide"
                          : "Draft — click to publish"
                      }
                    >
                      {festival.isPublished ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>
                    <Link
                      href={`/festivals/${festival._id}`}
                      className="inline-flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs font-bold tracking-widest text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      <Pencil size={13} /> EDIT
                    </Link>
                    <button
                      onClick={() => void handleDelete(festival)}
                      className="p-1.5 text-muted-foreground hover:text-red-400"
                      aria-label={`Delete ${festival.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                    No festival set up for {year} yet.
                  </p>
                  <button
                    onClick={() => void handleCreate(year)}
                    disabled={creatingYear !== null}
                    className="inline-flex shrink-0 items-center gap-2 rounded bg-primary px-4 py-2 text-xs font-bold tracking-widest text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    <Plus size={14} />{" "}
                    {creatingYear === year ? "CREATING..." : `SET UP ${year}`}
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
