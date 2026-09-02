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

type ScreeningRow = {
  /** Client-side only, stable across re-renders. Never sent to the server. */
  localId: string;
  title: string;
  posterUrl: string;
  posterKey: string;
  country: string;
  year: string;
  genre: string;
  runtimeMinutes: string;
  synopsis: string;
  trailerUrl: string;
  date: string;
  time: string;
  venue: string;
  seatStatus: SeatStatus;
};

type FestivalResponse = {
  success: boolean;
  message?: string;
  data: {
    _id: string;
    slug: string;
    edition: string;
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

const emptyScreening = (date: string): ScreeningRow => ({
  localId: newLocalId(),
  title: "",
  posterUrl: "",
  posterKey: "",
  country: "",
  year: String(new Date().getFullYear()),
  genre: "",
  runtimeMinutes: "",
  synopsis: "",
  trailerUrl: "",
  date,
  time: "",
  venue: "",
  seatStatus: "available",
});

const toRow = (raw: Record<string, unknown>): ScreeningRow => ({
  localId: newLocalId(),
  title: String(raw.title ?? ""),
  posterUrl: String(raw.posterUrl ?? ""),
  posterKey: String(raw.posterKey ?? ""),
  country: String(raw.country ?? ""),
  year: raw.year ? String(raw.year) : "",
  genre: String(raw.genre ?? ""),
  runtimeMinutes: raw.runtimeMinutes ? String(raw.runtimeMinutes) : "",
  synopsis: String(raw.synopsis ?? ""),
  trailerUrl: String(raw.trailerUrl ?? ""),
  date: String(raw.date ?? ""),
  time: String(raw.time ?? ""),
  venue: String(raw.venue ?? ""),
  seatStatus: (SEAT_STATUSES.find((s) => s.value === raw.seatStatus)?.value ??
    "available") as SeatStatus,
});

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
  const [edition, setEdition] = useState("01");
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
  const [openRow, setOpenRow] = useState<string | null>(null);

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
      setEdition(festival.edition ?? "01");
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

  const patchRow = (localId: string, patch: Partial<ScreeningRow>) =>
    setScreenings((rows) =>
      rows.map((row) => (row.localId === localId ? { ...row, ...patch } : row)),
    );

  const moveRow = (index: number, direction: -1 | 1) =>
    setScreenings((rows) => {
      const target = index + direction;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const removeRow = (localId: string) => {
    setScreenings((rows) => rows.filter((row) => row.localId !== localId));
    setPendingPosters((pending) => {
      const next = { ...pending };
      delete next[localId];
      return next;
    });
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
      setError("Every screening needs a film title");
      return;
    }
    const undated = screenings.find((row) => !row.date);
    if (undated) {
      setError(`"${undated.title}" needs a screening date`);
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

      const uploadedRows = await Promise.all(
        screenings.map(async (row) => {
          const file = pendingPosters[row.localId];
          if (!file) return row;
          const uploaded = await uploadFestivalImage(
            file,
            festivalId,
            "screenings",
            row.title,
          );
          return { ...row, posterUrl: uploaded.url, posterKey: uploaded.key };
        }),
      );

      await updateData(`/festivals/${festivalId}`, {
        name: name.trim(),
        slug: slug.trim(),
        edition: edition.trim(),
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
          posterUrl: row.posterUrl,
          posterKey: row.posterKey,
          country: row.country.trim(),
          year: Number(row.year) || 0,
          genre: row.genre.trim(),
          runtimeMinutes: Number(row.runtimeMinutes) || 0,
          synopsis: row.synopsis.trim(),
          trailerUrl: row.trailerUrl.trim(),
          date: row.date,
          time: row.time.trim(),
          venue: row.venue.trim(),
          seatStatus: row.seatStatus,
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
        Everything on this page appears on the public Festivals page once the
        festival is published.
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
                <label className={labelClass} htmlFor="f-edition">
                  Position in its month (shown as “Festival 01”)
                </label>
                <input id="f-edition" className={field} value={edition}
                  onChange={(e) => setEdition(e.target.value)} placeholder="01" />
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

            {screenings.length === 0 ? (
              <p className="rounded border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                No screenings yet. A festival can be published without them, but the
                page will show it as having none.
              </p>
            ) : (
              <div className="space-y-2">
                {screenings.map((row, index) => {
                  const isOpen = openRow === row.localId;
                  return (
                    <div key={row.localId} className="rounded border border-border bg-card/60">
                      <div className="flex items-center gap-3 p-3">
                        <span className="w-6 shrink-0 text-center text-xs text-muted-foreground">
                          {index + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setOpenRow(isOpen ? null : row.localId)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate text-sm font-semibold text-white">
                            {row.title || "Untitled film"}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[row.country, row.date, row.time, row.venue]
                              .filter(Boolean)
                              .join(" · ") || "No details yet"}
                          </p>
                        </button>
                        <div className="flex shrink-0 items-center gap-1">
                          <button type="button" onClick={() => moveRow(index, -1)}
                            disabled={index === 0}
                            className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-30"
                            aria-label="Move up">
                            <ChevronUp size={15} />
                          </button>
                          <button type="button" onClick={() => moveRow(index, 1)}
                            disabled={index === screenings.length - 1}
                            className="p-1.5 text-muted-foreground hover:text-primary disabled:opacity-30"
                            aria-label="Move down">
                            <ChevronDown size={15} />
                          </button>
                          <button type="button" onClick={() => removeRow(row.localId)}
                            className="p-1.5 text-muted-foreground hover:text-red-400"
                            aria-label={`Remove ${row.title || "screening"}`}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>

                      {isOpen && (
                        <div className="grid grid-cols-1 gap-4 border-t border-border p-4 md:grid-cols-2">
                          <div>
                            <label className={labelClass}>Film title *</label>
                            <input className={field} value={row.title}
                              onChange={(e) => patchRow(row.localId, { title: e.target.value })} />
                          </div>
                          <div>
                            <label className={labelClass}>Country</label>
                            <input className={field} value={row.country}
                              onChange={(e) => patchRow(row.localId, { country: e.target.value })}
                              placeholder="Oman" />
                          </div>
                          <div>
                            <label className={labelClass}>Year of production</label>
                            <input className={field} inputMode="numeric" value={row.year}
                              onChange={(e) => patchRow(row.localId, { year: e.target.value })} />
                          </div>
                          <div>
                            <label className={labelClass}>Genre</label>
                            <input className={field} value={row.genre}
                              onChange={(e) => patchRow(row.localId, { genre: e.target.value })}
                              placeholder="Drama" />
                          </div>
                          <div>
                            <label className={labelClass}>Runtime (minutes)</label>
                            <input className={field} inputMode="numeric" value={row.runtimeMinutes}
                              onChange={(e) => patchRow(row.localId, { runtimeMinutes: e.target.value })} />
                          </div>
                          <div>
                            <label className={labelClass}>Screening date *</label>
                            <input type="date" className={field} value={row.date}
                              onChange={(e) => patchRow(row.localId, { date: e.target.value })} />
                          </div>
                          <div>
                            <label className={labelClass}>Time — as it should read</label>
                            <input className={field} value={row.time}
                              onChange={(e) => patchRow(row.localId, { time: e.target.value })}
                              placeholder="7:30 PM" />
                          </div>
                          <div>
                            <label className={labelClass}>Venue</label>
                            <input className={field} value={row.venue}
                              onChange={(e) => patchRow(row.localId, { venue: e.target.value })}
                              placeholder="Main Theatre" />
                          </div>
                          <div>
                            <label className={labelClass}>Seat status</label>
                            <select className={field} value={row.seatStatus}
                              onChange={(e) =>
                                patchRow(row.localId, { seatStatus: e.target.value as SeatStatus })
                              }>
                              {SEAT_STATUSES.map((status) => (
                                <option key={status.value} value={status.value}>
                                  {status.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={labelClass}>Trailer URL — YouTube</label>
                            <input className={field} value={row.trailerUrl}
                              onChange={(e) => patchRow(row.localId, { trailerUrl: e.target.value })}
                              placeholder="https://youtu.be/…" />
                          </div>
                          <div className="md:col-span-2">
                            <label className={labelClass}>Synopsis</label>
                            <textarea rows={3} className={field} value={row.synopsis}
                              onChange={(e) => patchRow(row.localId, { synopsis: e.target.value })} />
                          </div>
                          <div className="md:col-span-2">
                            <label className={labelClass}>
                              Poster — portrait. Leave empty and the website draws a
                              typographic poster from the title.
                            </label>
                            <FestivalImageUpload
                              shape="portrait"
                              existingUrl={row.posterUrl}
                              pendingFile={pendingPosters[row.localId] ?? null}
                              onSelect={(file) =>
                                setPendingPosters((pending) => {
                                  const next = { ...pending };
                                  if (file) next[row.localId] = file;
                                  else delete next[row.localId];
                                  return next;
                                })
                              }
                              onClearExisting={() =>
                                patchRow(row.localId, { posterUrl: "", posterKey: "" })
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
