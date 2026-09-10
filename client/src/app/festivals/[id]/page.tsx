"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/providers/auth-context";
import { getData, updateData } from "@/lib/fetch-util";
import FestivalImageUpload, {
  uploadFestivalImage,
} from "@/components/festivals/festival-image-upload";
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

/**
 * One festival and its screenings, edited and saved together.
 *
 * IFFA runs one festival a year and the backend enforces it with a unique
 * index on the year, which is derived from the start date. Moving the start
 * date into a year that already has a festival is therefore the one edit the
 * server will refuse — the banner under the dates says so before the save
 * rather than after it.
 *
 * Screenings are embedded in the festival document, so this page owns the whole
 * programme: there is one Save, and the array it sends replaces what is stored.
 * Images are the exception — they upload first (they have to exist before the
 * document can reference them), and only then does the document write.
 */

const SEAT_STATUSES = [
  { value: "available", label: "Seats available" },
  { value: "limited", label: "Seats limited" },
  { value: "sold-out", label: "Sold out" },
] as const;

type SeatStatus = (typeof SEAT_STATUSES)[number]["value"];

/**
 * One film inside a screening.
 *
 * Carries nothing about where it plays — the venue is the session's. When it
 * plays is an optional override: blank means "plays with its session", which
 * is the normal case, and a value is for the shorts block whose six films
 * start at six different minutes or the strand that plays a different film
 * each day of its run.
 */
type FilmRow = {
  /** Client-side only, stable across re-renders. Never sent to the server. */
  localId: string;
  title: string;
  posterUrl: string;
  posterKey: string;
  country: string;
  year: string;
  genre: string;
  /** Blank unless this film overrides its session's date. ISO, within the session's range. */
  startDate: string;
  /** Blank unless this film overrides its session's time. Free text: "7:45 PM". */
  startTime: string;
  /** Kept as strings so a half-typed field stays exactly what staff typed. */
  runtimeMinutes: string;
  runtimeSeconds: string;
  synopsis: string;
  trailerUrl: string;
};

/**
 * One session: a named block of films at a time and place.
 *
 * Time, venue and seat status sit here rather than on each film, because that
 * is what they describe. A shorts block used to be six separate screenings
 * repeating the same time and venue six times, with nothing naming the block.
 */
type ScreeningRow = {
  localId: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  time: string;
  venue: string;
  seatStatus: SeatStatus;
  films: FilmRow[];
};

type FestivalResponse = {
  success: boolean;
  message?: string;
  data: {
    _id: string;
    slug: string;
    name: string;
    tagline?: string;
    description?: string;
    heroImageUrl?: string;
    heroImageKey?: string;
    city?: string;
    startDate: string;
    endDate: string;
    isPublished?: boolean;
    screenings: Record<string, unknown>[];
  };
};

const newLocalId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Math.random());

const emptyFilm = (): FilmRow => ({
  localId: newLocalId(),
  title: "",
  posterUrl: "",
  posterKey: "",
  country: "",
  year: String(new Date().getFullYear()),
  genre: "",
  // Blank, not the session's date: a copy would be indistinguishable from a
  // deliberate override, and every film would then need clearing by hand when
  // the session moved.
  startDate: "",
  startTime: "",
  runtimeMinutes: "",
  runtimeSeconds: "",
  synopsis: "",
  trailerUrl: "",
});

const emptyScreening = (date: string): ScreeningRow => ({
  localId: newLocalId(),
  title: "",
  description: "",
  startDate: date,
  // Most sessions run once, so the end date starts equal to the start and
  // staff only touch it for a strand that actually repeats.
  endDate: date,
  time: "",
  venue: "",
  seatStatus: "available",
  films: [emptyFilm()],
});

const toFilmRow = (raw: Record<string, unknown>): FilmRow => ({
  localId: newLocalId(),
  title: String(raw.title ?? ""),
  posterUrl: String(raw.posterUrl ?? ""),
  posterKey: String(raw.posterKey ?? ""),
  country: String(raw.country ?? ""),
  year: raw.year ? String(raw.year) : "",
  genre: String(raw.genre ?? ""),
  startDate: String(raw.startDate ?? ""),
  startTime: String(raw.startTime ?? ""),
  runtimeMinutes: raw.runtimeMinutes ? String(raw.runtimeMinutes) : "",
  runtimeSeconds: raw.runtimeSeconds ? String(raw.runtimeSeconds) : "",
  synopsis: String(raw.synopsis ?? ""),
  trailerUrl: String(raw.trailerUrl ?? ""),
});

/**
 * Reads a stored screening, in either shape.
 *
 * A pre-migration row IS a film: it has `date` and the film's own fields, and
 * no `films` array. Reading it as a session of one means staff can open and
 * save a festival that has not been through
 * `scripts/migrate-screenings-to-sessions.ts` yet, rather than being shown an
 * empty programme and re-typing it. Saving writes the new shape back.
 */
const toRow = (raw: Record<string, unknown>): ScreeningRow => {
  const legacy = !Array.isArray(raw.films);
  const startDate = String(raw.startDate ?? raw.date ?? "");
  const rawEnd = String(raw.endDate ?? "");

  return {
    localId: newLocalId(),
    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    startDate,
    endDate: rawEnd || startDate,
    time: String(raw.time ?? ""),
    venue: String(raw.venue ?? ""),
    seatStatus: (SEAT_STATUSES.find((s) => s.value === raw.seatStatus)?.value ??
      "available") as SeatStatus,
    films: legacy
      ? [toFilmRow(raw)]
      : (raw.films as Record<string, unknown>[]).map(toFilmRow),
  };
};

/**
 * Runtime for the collapsed film row. Either half can be blank while a film is
 * being entered, so each is shown only when it holds something.
 */
const runtimeLabel = (minutes: string, seconds: string): string =>
  [minutes && `${minutes} min`, seconds && `${seconds} sec`].filter(Boolean).join(" ");

const errorMessage = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

const field =
  "w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground";
const labelClass = "mb-1 block text-xs text-muted-foreground";

export default function FestivalEditorPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const festivalId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  const [heroUrl, setHeroUrl] = useState("");
  const [heroKey, setHeroKey] = useState("");
  const [pendingHero, setPendingHero] = useState<File | null>(null);

  const [screenings, setScreenings] = useState<ScreeningRow[]>([]);
  const [pendingPosters, setPendingPosters] = useState<Record<string, File>>({});
  const [openScreening, setOpenScreening] = useState<string | null>(null);
  const [openFilm, setOpenFilm] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user?.role !== "admin" && user?.role !== "staff") {
      router.replace("/");
    }
  }, [isAuthenticated, user, router]);

  const load = useCallback(async () => {
    if (!festivalId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getData<FestivalResponse>(`/festivals/manage/${festivalId}`);
      const festival = res?.data;
      if (!festival) throw new Error("Festival not found");

      setName(festival.name ?? "");
      setSlug(festival.slug ?? "");
      setTagline(festival.tagline ?? "");
      setDescription(festival.description ?? "");
      setCity(festival.city ?? "");
      setStartDate(festival.startDate ?? "");
      setEndDate(festival.endDate ?? "");
      setIsPublished(!!festival.isPublished);
      setHeroUrl(festival.heroImageUrl ?? "");
      setHeroKey(festival.heroImageKey ?? "");
      setScreenings((festival.screenings ?? []).map(toRow));
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to load festival"));
    } finally {
      setLoading(false);
    }
  }, [festivalId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchScreening = (localId: string, patch: Partial<ScreeningRow>) =>
    setScreenings((rows) =>
      rows.map((row) => (row.localId === localId ? { ...row, ...patch } : row)),
    );

  const patchFilm = (
    screeningId: string,
    filmId: string,
    patch: Partial<FilmRow>,
  ) =>
    setScreenings((rows) =>
      rows.map((row) =>
        row.localId === screeningId
          ? {
              ...row,
              films: row.films.map((film) =>
                film.localId === filmId ? { ...film, ...patch } : film,
              ),
            }
          : row,
      ),
    );

  /** Swaps an item with its neighbour. Shared by both levels — same operation. */
  const swap = <T,>(items: T[], index: number, direction: -1 | 1): T[] => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return items;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  };

  const moveScreening = (index: number, direction: -1 | 1) =>
    setScreenings((rows) => swap(rows, index, direction));

  const moveFilm = (screeningId: string, index: number, direction: -1 | 1) =>
    setScreenings((rows) =>
      rows.map((row) =>
        row.localId === screeningId
          ? { ...row, films: swap(row.films, index, direction) }
          : row,
      ),
    );

  /**
   * Drops any pending poster belonging to the removed rows.
   *
   * Keyed by film localId, so removing a whole screening has to clear every
   * film under it — otherwise an upload fires on save for a film that is no
   * longer in the payload, and lands an orphan in the bucket.
   */
  const forgetPosters = (filmIds: string[]) =>
    setPendingPosters((pending) => {
      const next = { ...pending };
      for (const id of filmIds) delete next[id];
      return next;
    });

  const removeScreening = (localId: string) => {
    const row = screenings.find((entry) => entry.localId === localId);
    setScreenings((rows) => rows.filter((entry) => entry.localId !== localId));
    forgetPosters((row?.films ?? []).map((film) => film.localId));
  };

  const addFilm = (screeningId: string) =>
    setScreenings((rows) =>
      rows.map((row) =>
        row.localId === screeningId
          ? { ...row, films: [...row.films, emptyFilm()] }
          : row,
      ),
    );

  const removeFilm = (screeningId: string, filmId: string) => {
    setScreenings((rows) =>
      rows.map((row) =>
        row.localId === screeningId
          ? { ...row, films: row.films.filter((film) => film.localId !== filmId) }
          : row,
      ),
    );
    forgetPosters([filmId]);
  };

  const handleSave = async () => {
    if (!festivalId) return;
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!startDate || !endDate) {
      setError("Start and end dates are required");
      return;
    }
    const untitled = screenings.find((row) => !row.title.trim());
    if (untitled) {
      setError("Every screening needs a title");
      return;
    }
    const undated = screenings.find((row) => !row.startDate);
    if (undated) {
      setError(`"${undated.title}" needs a start date`);
      return;
    }
    // Caught here as well as on the server so staff see it against the field
    // they just typed, rather than as a rejected save a scroll away.
    const backwards = screenings.find(
      (row) => row.endDate && row.endDate < row.startDate,
    );
    if (backwards) {
      setError(`"${backwards.title}" ends before it starts — check its dates`);
      return;
    }
    const namelessFilm = screenings.find((row) =>
      row.films.some((film) => !film.title.trim()),
    );
    if (namelessFilm) {
      setError(`Every film in "${namelessFilm.title}" needs a title`);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Images first: the document cannot reference a file that does not exist
      // yet. Uploading here rather than on selection means an abandoned edit
      // never leaves an orphan in the bucket.
      let nextHeroUrl = heroUrl;
      let nextHeroKey = heroKey;
      if (pendingHero) {
        const uploaded = await uploadFestivalImage(pendingHero, festivalId, "hero");
        nextHeroUrl = uploaded.url;
        nextHeroKey = uploaded.key;
      }

      // Posters upload per film, in parallel across the whole programme. The
      // folder group stays "screenings" so previously uploaded posters keep
      // resolving — the S3 layout is not what changed here.
      const uploadedRows = await Promise.all(
        screenings.map(async (row) => ({
          ...row,
          films: await Promise.all(
            row.films.map(async (film) => {
              const file = pendingPosters[film.localId];
              if (!file) return film;
              const uploaded = await uploadFestivalImage(
                file,
                festivalId,
                "screenings",
                film.title,
              );
              return { ...film, posterUrl: uploaded.url, posterKey: uploaded.key };
            }),
          ),
        })),
      );

      await updateData(`/festivals/${festivalId}`, {
        name: name.trim(),
        slug: slug.trim(),
        tagline: tagline.trim(),
        description: description.trim(),
        city: city.trim(),
        startDate,
        endDate,
        isPublished,
        heroImageUrl: nextHeroUrl,
        heroImageKey: nextHeroKey,
        screenings: uploadedRows.map((row) => ({
          title: row.title.trim(),
          description: row.description.trim(),
          startDate: row.startDate,
          // A blank end date means a single sitting. Sent as the start rather
          // than as "" so the stored document always carries a real range.
          endDate: row.endDate || row.startDate,
          time: row.time.trim(),
          venue: row.venue.trim(),
          seatStatus: row.seatStatus,
          films: row.films.map((film) => ({
            title: film.title.trim(),
            posterUrl: film.posterUrl,
            posterKey: film.posterKey,
            country: film.country.trim(),
            year: Number(film.year) || 0,
            genre: film.genre.trim(),
            startDate: film.startDate,
            startTime: film.startTime.trim(),
            runtimeMinutes: Number(film.runtimeMinutes) || 0,
            runtimeSeconds: Number(film.runtimeSeconds) || 0,
            synopsis: film.synopsis.trim(),
            trailerUrl: film.trailerUrl.trim(),
          })),
        })),
      });

      setPendingHero(null);
      setPendingPosters({});
      setSuccess("Festival saved.");
      await load();
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to save festival"));
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) return null;
  if (isAuthenticated && user?.role !== "admin" && user?.role !== "staff") return null;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/festivals"
        className="mb-6 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-primary"
      >
        <ArrowLeft size={14} /> All festivals
      </Link>

      <h1 className="mb-2 font-serif text-3xl text-white md:text-4xl">
        {name || "Untitled festival"}
      </h1>
      <p className="mb-8 text-sm text-accent-foreground">
        Everything on this page appears on the public Festival page once the
        festival is published. The current or next year&rsquo;s published
        festival is the one the site is built around; earlier years become the
        archive.
      </p>

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
          <div className="h-32 animate-pulse rounded bg-card/60" />
          <div className="h-32 animate-pulse rounded bg-card/60" />
        </div>
      ) : (
        <>
          <section className="mb-8 space-y-4 rounded-lg border border-border bg-card/60 p-6">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Festival
            </h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="f-name">Name *</label>
                <input id="f-name" className={field} value={name}
                  onChange={(e) => setName(e.target.value)} placeholder="e.g. Night Frequencies" />
              </div>
              <div>
                <label className={labelClass} htmlFor="f-slug">
                  URL slug — the website address, /festivals/&lt;slug&gt;
                </label>
                <input id="f-slug" className={field} value={slug}
                  onChange={(e) => setSlug(e.target.value)} placeholder="night-frequencies" />
              </div>
              <div>
                <label className={labelClass} htmlFor="f-city">City</label>
                <input id="f-city" className={field} value={city}
                  onChange={(e) => setCity(e.target.value)} placeholder="Melbourne" />
              </div>
              <div>
                <label className={labelClass} htmlFor="f-start">Start date *</label>
                <input id="f-start" type="date" className={field} value={startDate}
                  onChange={(e) => setStartDate(e.target.value)} />
                <p className="mt-1 text-xs text-muted-foreground/70">
                  {startDate
                    ? `This is the ${startDate.slice(0, 4)} festival. Only one festival can exist per year.`
                    : "The year of this date decides which festival year this is."}
                </p>
              </div>
              <div>
                <label className={labelClass} htmlFor="f-end">End date *</label>
                <input id="f-end" type="date" className={field} value={endDate}
                  onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass} htmlFor="f-tagline">
                  Tagline — one line under the festival name
                </label>
                <input id="f-tagline" className={field} value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  placeholder="Sound, signal and the small hours" />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass} htmlFor="f-description">Description</label>
                <textarea id="f-description" rows={4} className={field} value={description}
                  onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Hero image — landscape banner</label>
                <FestivalImageUpload
                  existingUrl={heroUrl}
                  pendingFile={pendingHero}
                  onSelect={setPendingHero}
                  onClearExisting={() => { setHeroUrl(""); setHeroKey(""); }}
                  label="Select hero image (PNG, WEBP or JPEG)"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-foreground md:col-span-2">
                <input type="checkbox" checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)} />
                Show this festival on the public website
              </label>
            </div>
          </section>

          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground">
                Screenings ({screenings.length})
              </h2>
              <button
                type="button"
                onClick={() =>
                  setScreenings((rows) => [...rows, emptyScreening(startDate)])
                }
                className="inline-flex items-center gap-2 rounded border border-border px-3 py-1.5 text-xs font-bold tracking-widest text-muted-foreground hover:border-primary hover:text-primary"
              >
                <Plus size={14} /> ADD SCREENING
              </button>
            </div>

            <p className="mb-3 text-xs text-muted-foreground/70">
              A screening is one session — what a ticket admits someone to. It
              holds however many films play in it, so a shorts block is one
              screening with six films rather than six screenings.
            </p>

            {screenings.length === 0 ? (
              <p className="rounded border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                No screenings yet. A festival can be published without them, but the
                page will show it as having none.
              </p>
            ) : (
              <div className="space-y-2">
                {screenings.map((row, index) => {
                  const isOpen = openScreening === row.localId;
                  const dates =
                    row.startDate && row.endDate && row.endDate !== row.startDate
                      ? `${row.startDate} → ${row.endDate}`
                      : row.startDate;

                  return (
                    <div key={row.localId} className="rounded border border-border bg-card/60">
                      <div className="flex items-center gap-3 p-3">
                        <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">
                          {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setOpenScreening(isOpen ? null : row.localId)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-sm font-semibold text-white">
                            {row.title || "Untitled screening"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[
                              dates,
                              row.time,
                              row.venue,
                              `${row.films.length} ${row.films.length === 1 ? "film" : "films"}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          <button type="button" onClick={() => moveScreening(index, -1)}
                            disabled={index === 0}
                            className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-30"
                            aria-label="Move screening up">
                            <ChevronUp size={15} />
                          </button>
                          <button type="button" onClick={() => moveScreening(index, 1)}
                            disabled={index === screenings.length - 1}
                            className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-30"
                            aria-label="Move screening down">
                            <ChevronDown size={15} />
                          </button>
                          <button type="button" onClick={() => removeScreening(row.localId)}
                            className="p-1.5 text-muted-foreground hover:text-red-400"
                            aria-label={`Remove ${row.title || "screening"}`}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="border-t border-border p-4">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="md:col-span-2">
                              <label className={labelClass}>Screening title *</label>
                              <input className={field} value={row.title}
                                onChange={(e) => patchScreening(row.localId, { title: e.target.value })}
                                placeholder="Opening Night Gala" />
                            </div>
                            <div>
                              <label className={labelClass}>Start date *</label>
                              <input type="date" className={field} value={row.startDate}
                                onChange={(e) => {
                                  const startDateValue = e.target.value;
                                  // A session that ran one day keeps doing so
                                  // when its date moves. Only a real range,
                                  // already set, is left for staff to adjust.
                                  patchScreening(row.localId, {
                                    startDate: startDateValue,
                                    endDate:
                                      !row.endDate || row.endDate === row.startDate
                                        ? startDateValue
                                        : row.endDate,
                                  });
                                }} />
                            </div>
                            <div>
                              <label className={labelClass}>End date</label>
                              <input type="date" className={field} value={row.endDate}
                                min={row.startDate || undefined}
                                onChange={(e) => patchScreening(row.localId, { endDate: e.target.value })} />
                              <p className="mt-1 text-xs text-muted-foreground/70">
                                Same as the start date for a single sitting. Set a
                                later date only for a strand that runs across days.
                              </p>
                            </div>
                            <div>
                              <label className={labelClass}>Time — as it should read</label>
                              <input className={field} value={row.time}
                                onChange={(e) => patchScreening(row.localId, { time: e.target.value })}
                                placeholder="7:30 PM" />
                            </div>
                            <div>
                              <label className={labelClass}>Venue</label>
                              <input className={field} value={row.venue}
                                onChange={(e) => patchScreening(row.localId, { venue: e.target.value })}
                                placeholder="Main Theatre" />
                            </div>
                            <div>
                              <label className={labelClass}>Seat status</label>
                              <select className={field} value={row.seatStatus}
                                onChange={(e) =>
                                  patchScreening(row.localId, {
                                    seatStatus: e.target.value as SeatStatus,
                                  })
                                }>
                                {SEAT_STATUSES.map((status) => (
                                  <option key={status.value} value={status.value}>
                                    {status.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="md:col-span-2">
                              <label className={labelClass}>
                                Description — a short blurb for the session as a whole
                              </label>
                              <textarea rows={2} className={field} value={row.description}
                                onChange={(e) => patchScreening(row.localId, { description: e.target.value })} />
                            </div>
                          </div>

                          <div className="mt-6 rounded border border-border/70 bg-background/40 p-3">
                            <div className="mb-3 flex items-center justify-between">
                              <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                                Films in this screening ({row.films.length})
                              </h3>
                              <button
                                type="button"
                                onClick={() => addFilm(row.localId)}
                                className="inline-flex items-center gap-2 rounded border border-border px-2.5 py-1 text-xs font-bold tracking-widest text-muted-foreground hover:border-primary hover:text-primary"
                              >
                                <Plus size={13} /> ADD FILM
                              </button>
                            </div>

                            {row.films.length === 0 ? (
                              <p className="rounded border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                                No films yet. The website will show this screening
                                with its lineup to be announced.
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {row.films.map((film, filmIndex) => {
                                  const filmOpen = openFilm === film.localId;
                                  return (
                                    <div key={film.localId} className="rounded border border-border bg-card/60">
                                      <div className="flex items-center gap-3 p-2.5">
                                        <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">
                                          {filmIndex + 1}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setOpenFilm(filmOpen ? null : film.localId)}
                                          className="min-w-0 flex-1 text-left"
                                        >
                                          <p className="truncate text-sm font-semibold text-white">
                                            {film.title || "Untitled film"}
                                          </p>
                                          <p className="truncate text-xs text-muted-foreground">
                                            {[
                                              // Only when this film overrides its
                                              // session — the collapsed row is for
                                              // spotting what differs, and the
                                              // session's own slot is in the header
                                              // right above.
                                              [film.startDate, film.startTime]
                                                .filter(Boolean)
                                                .join(" "),
                                              film.country,
                                              film.year,
                                              film.genre,
                                              runtimeLabel(film.runtimeMinutes, film.runtimeSeconds),
                                            ]
                                              .filter(Boolean)
                                              .join(" · ") || "No details yet"}
                                          </p>
                                        </button>
                                        <div className="flex shrink-0 items-center gap-1">
                                          <button type="button"
                                            onClick={() => moveFilm(row.localId, filmIndex, -1)}
                                            disabled={filmIndex === 0}
                                            className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-30"
                                            aria-label="Move film up">
                                            <ChevronUp size={14} />
                                          </button>
                                          <button type="button"
                                            onClick={() => moveFilm(row.localId, filmIndex, 1)}
                                            disabled={filmIndex === row.films.length - 1}
                                            className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-30"
                                            aria-label="Move film down">
                                            <ChevronDown size={14} />
                                          </button>
                                          <button type="button"
                                            onClick={() => removeFilm(row.localId, film.localId)}
                                            className="p-1.5 text-muted-foreground hover:text-red-400"
                                            aria-label={`Remove ${film.title || "film"}`}>
                                            <Trash2 size={14} />
                                          </button>
                                        </div>
                                      </div>

                                      {filmOpen && (
                                        <div className="grid grid-cols-1 gap-4 border-t border-border p-4 md:grid-cols-2">
                                          <div className="md:col-span-2">
                                            <label className={labelClass}>Film title *</label>
                                            <input className={field} value={film.title}
                                              onChange={(e) => patchFilm(row.localId, film.localId, { title: e.target.value })} />
                                          </div>
                                          {/* Both blank is the normal state. Filled in only
                                              where a film does not simply play with its
                                              session — a shorts block that starts its six
                                              films at six different minutes, or a strand
                                              across days that plays a different film each
                                              day. The date input is bounded by the
                                              session's own range; the server rejects a
                                              date outside it rather than clamping. */}
                                          <div className="md:col-span-2">
                                            <label className={labelClass}>
                                              Plays on — leave blank to use the screening&apos;s own date and time
                                            </label>
                                            <div className="flex items-center gap-2">
                                              <input type="date" className={field} value={film.startDate}
                                                min={row.startDate || undefined}
                                                max={row.endDate || row.startDate || undefined}
                                                onChange={(e) => patchFilm(row.localId, film.localId, { startDate: e.target.value })}
                                                aria-label={`Date ${film.title || "this film"} plays`} />
                                              <input className={field} value={film.startTime}
                                                onChange={(e) => patchFilm(row.localId, film.localId, { startTime: e.target.value })}
                                                aria-label={`Time ${film.title || "this film"} starts`}
                                                placeholder="7:45 PM" />
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                              Must fall inside the screening&apos;s dates
                                              {row.startDate
                                                ? `, ${row.startDate}${row.endDate && row.endDate !== row.startDate ? ` to ${row.endDate}` : ""}`
                                                : ""}
                                              . The time reads exactly as typed.
                                            </p>
                                          </div>
                                          <div>
                                            <label className={labelClass}>Country</label>
                                            <input className={field} value={film.country}
                                              onChange={(e) => patchFilm(row.localId, film.localId, { country: e.target.value })}
                                              placeholder="Oman" />
                                          </div>
                                          <div>
                                            <label className={labelClass}>Year of production</label>
                                            <input className={field} inputMode="numeric" value={film.year}
                                              onChange={(e) => patchFilm(row.localId, film.localId, { year: e.target.value })} />
                                          </div>
                                          <div>
                                            <label className={labelClass}>Genre</label>
                                            <input className={field} value={film.genre}
                                              onChange={(e) => patchFilm(row.localId, film.localId, { genre: e.target.value })}
                                              placeholder="Drama" />
                                          </div>
                                          <div>
                                            <label className={labelClass}>Runtime</label>
                                            <div className="flex items-center gap-2">
                                              <input className={field} inputMode="numeric" value={film.runtimeMinutes}
                                                onChange={(e) => patchFilm(row.localId, film.localId, { runtimeMinutes: e.target.value })}
                                                aria-label="Runtime minutes" placeholder="Minutes" />
                                              <input className={field} inputMode="numeric" value={film.runtimeSeconds}
                                                onChange={(e) => patchFilm(row.localId, film.localId, { runtimeSeconds: e.target.value })}
                                                aria-label="Runtime seconds" placeholder="Seconds" />
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">Minutes, then seconds (0-59).</p>
                                          </div>
                                          <div>
                                            <label className={labelClass}>Trailer URL — YouTube</label>
                                            <input className={field} value={film.trailerUrl}
                                              onChange={(e) => patchFilm(row.localId, film.localId, { trailerUrl: e.target.value })}
                                              placeholder="https://youtu.be/…" />
                                          </div>
                                          <div className="md:col-span-2">
                                            <label className={labelClass}>Synopsis</label>
                                            <textarea rows={3} className={field} value={film.synopsis}
                                              onChange={(e) => patchFilm(row.localId, film.localId, { synopsis: e.target.value })} />
                                          </div>
                                          <div className="md:col-span-2">
                                            <label className={labelClass}>
                                              Poster — portrait. Leave empty and the website draws a
                                              typographic poster from the title.
                                            </label>
                                            <FestivalImageUpload
                                              shape="portrait"
                                              existingUrl={film.posterUrl}
                                              pendingFile={pendingPosters[film.localId] ?? null}
                                              onSelect={(file) =>
                                                setPendingPosters((pending) => {
                                                  const next = { ...pending };
                                                  if (file) next[film.localId] = file;
                                                  else delete next[film.localId];
                                                  return next;
                                                })
                                              }
                                              onClearExisting={() =>
                                                patchFilm(row.localId, film.localId, {
                                                  posterUrl: "",
                                                  posterKey: "",
                                                })
                                              }
                                              label="Select poster (PNG, WEBP or JPEG)"
                                            />
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded bg-foreground px-6 py-2.5 text-xs font-bold tracking-widest text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "SAVING..." : "SAVE FESTIVAL"}
            </button>
            <Link
              href="/festivals"
              className="rounded border border-border px-6 py-2.5 text-xs font-bold tracking-widest text-muted-foreground hover:border-primary hover:text-primary"
            >
              DONE
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
