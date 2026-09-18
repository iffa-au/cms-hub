"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-context";
import { getData, updateData } from "@/lib/fetch-util";
import { GripVertical, Plus, X, ChevronUp, ChevronDown } from "lucide-react";

type Film = {
  _id: string;
  title: string;
  potraitImageUrl?: string;
  landscapeImageUrl?: string;
  submission_year?: number;
  status?: string;
};

type Slot = {
  submissionId: string;
  badge: string;
  titleAccent: string;
  genre: string;
  /** null when the submission was deleted after it was featured. */
  film: Film | null;
};

type ManageResponse = {
  success: boolean;
  data: Slot[];
  max?: number;
};

type CandidatesResponse = {
  success: boolean;
  data: Film[];
};

const DEFAULT_MAX_SLOTS = 6;
const DEFAULT_BADGE = "Official Selection";

const thumbUrl = (f: Film) => f.potraitImageUrl || f.landscapeImageUrl || "";

/**
 * Mirrors how the public site splits the title: the accent is used only when
 * the title actually ends with it, otherwise the last word takes the colour.
 */
const splitTitle = (title: string, accent: string): [string, string] => {
  const clean = title.trim();
  const wanted = accent.trim();
  if (wanted && clean.toLowerCase().endsWith(wanted.toLowerCase())) {
    const cut = clean.length - wanted.length;
    return [clean.slice(0, cut).trim(), clean.slice(cut).trim()];
  }
  const lastSpace = clean.lastIndexOf(" ");
  return lastSpace === -1 ? ["", clean] : [clean.slice(0, lastSpace), clean.slice(lastSpace + 1)];
};

export default function FeaturedFilmManagementPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [slots, setSlots] = useState<Slot[]>([]);
  const [maxSlots, setMaxSlots] = useState(DEFAULT_MAX_SLOTS);
  const [candidates, setCandidates] = useState<Film[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isStaff = user?.role === "admin" || user?.role === "staff";

  useEffect(() => {
    if (isAuthenticated && !isStaff) router.replace("/");
  }, [isAuthenticated, isStaff, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getData<ManageResponse>("/featured-films/manage");
        if (cancelled) return;
        setSlots(res?.data ?? []);
        if (res?.max) setMaxSlots(res.max);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load featured films");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Searched on the server, not filtered locally: the candidate endpoint caps
  // at the 200 newest approved films, so an older film is only reachable by
  // asking for it by title.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const q = query.trim();
        const res = await getData<CandidatesResponse>(
          q ? `/submissions/carousel?q=${encodeURIComponent(q)}` : "/submissions/carousel",
        );
        if (!cancelled) setCandidates(res?.data ?? []);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load films");
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const selectedIds = slots.map((s) => s.submissionId);
  const full = slots.length >= maxSlots;

  const addFilm = (film: Film) => {
    setSuccess(null);
    if (selectedIds.includes(film._id) || full) return;
    setSlots((prev) => [
      ...prev,
      { submissionId: film._id, badge: "", titleAccent: "", genre: "", film },
    ]);
  };

  const removeFilm = (id: string) => {
    setSuccess(null);
    setSlots((prev) => prev.filter((s) => s.submissionId !== id));
  };

  const move = (index: number, direction: -1 | 1) => {
    setSuccess(null);
    setSlots((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const updateSlot = (index: number, field: "badge" | "titleAccent" | "genre", value: string) => {
    setSuccess(null);
    setSlots((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await updateData("/featured-films", {
        entries: slots.map(({ submissionId, badge, titleAccent, genre }) => ({
          submissionId,
          badge,
          titleAccent,
          genre,
        })),
      });
      setSuccess("Featured films updated — changes are live on the homepage now.");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save featured films");
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated || !isStaff) return null;

  const inputClass =
    "w-full bg-card border border-border rounded px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/70";

  return (
    <main className="mx-auto w-full flex-1 px-4 py-8 sm:px-6 sm:py-10 lg:px-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Featured Film Management
        </h1>
        <p className="text-accent-foreground text-sm">
          Pick up to {maxSlots} approved films for the Featured Selection row on the homepage.
          Order here is the order they play in. Poster, synopsis, director, runtime, country
          and trailer come from each film&apos;s submission.
        </p>
      </div>

      {error && (
        <p className="text-red-400 text-sm mb-4 rounded border border-red-400/30 bg-red-400/10 px-4 py-2">
          {error}
        </p>
      )}
      {success && (
        <p className="text-green-400 text-sm mb-4 rounded border border-green-400/30 bg-green-400/10 px-4 py-2">
          {success}
        </p>
      )}

      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-24 bg-card/60 rounded" />
          <div className="h-24 bg-card/60 rounded" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-8">
          {/* Selected slots */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Selected ({slots.length}/{maxSlots})
            </h2>
            <div className="space-y-2">
              {Array.from({ length: maxSlots }).map((_, i) => {
                const slot = slots[i];
                if (!slot) {
                  return (
                    <div
                      key={`empty-${i}`}
                      className="flex items-center gap-3 rounded border border-border bg-card/60 p-3 min-h-[76px]"
                    >
                      <span className="text-lg font-serif text-primary w-6 text-center shrink-0">
                        {i + 1}
                      </span>
                      <p className="text-muted-foreground text-xs">Empty slot</p>
                    </div>
                  );
                }

                const film = slot.film;
                const [plain, accent] = film ? splitTitle(film.title, slot.titleAccent) : ["", ""];
                const notLive = !film || film.status !== "APPROVED";

                return (
                  <div
                    key={slot.submissionId}
                    className="rounded border border-border bg-card/60 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-serif text-primary w-6 text-center shrink-0">
                        {i + 1}
                      </span>
                      <GripVertical size={16} className="text-muted-foreground shrink-0" />
                      <div className="h-12 w-9 rounded overflow-hidden bg-black shrink-0">
                        {film && thumbUrl(film) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumbUrl(film)} alt="" className="h-full w-full object-cover" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm font-semibold truncate">
                          {film ? film.title : "Deleted submission"}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {film?.submission_year ?? ""}
                          {notLive && (
                            <span className="ml-2 text-red-400">
                              {film ? `${film.status?.toLowerCase()} — hidden on site` : "hidden on site"}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => move(i, -1)}
                          disabled={i === 0}
                          className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label="Move up"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          onClick={() => move(i, 1)}
                          disabled={i === slots.length - 1}
                          className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                          aria-label="Move down"
                        >
                          <ChevronDown size={16} />
                        </button>
                        <button
                          onClick={() => removeFilm(slot.submissionId)}
                          className="p-1 text-muted-foreground hover:text-red-400"
                          aria-label="Remove from featured films"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    {film && (
                      <div className="mt-3 pl-9 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <label className="block">
                            <span className="text-muted-foreground text-[11px]">Badge</span>
                            <input
                              value={slot.badge}
                              onChange={(e) => updateSlot(i, "badge", e.target.value)}
                              placeholder={DEFAULT_BADGE}
                              maxLength={40}
                              className={inputClass}
                            />
                          </label>
                          <label className="block">
                            <span className="text-muted-foreground text-[11px]">
                              Highlighted title ending
                            </span>
                            <input
                              value={slot.titleAccent}
                              onChange={(e) => updateSlot(i, "titleAccent", e.target.value)}
                              placeholder="Last word"
                              maxLength={200}
                              className={inputClass}
                            />
                          </label>
                          <label className="block">
                            <span className="text-muted-foreground text-[11px]">Genre</span>
                            <input
                              value={slot.genre}
                              onChange={(e) => updateSlot(i, "genre", e.target.value)}
                              placeholder="First two genres"
                              maxLength={60}
                              className={inputClass}
                            />
                          </label>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Preview:{" "}
                          <span className="text-yellow-500 uppercase tracking-widest text-[10px]">
                            * {slot.badge.trim() || DEFAULT_BADGE}
                          </span>{" "}
                          <span className="text-white font-semibold">
                            {plain}
                            {plain && accent ? " " : ""}
                            <span className="text-yellow-500">{accent}</span>
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="mt-6 w-full bg-foreground text-background px-6 py-3 rounded text-xs font-bold tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "SAVING..." : "SAVE FEATURED FILMS"}
            </button>
          </section>

          {/* Browse / add */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Approved Films</h2>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title..."
              className="w-full bg-card border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 mb-3"
            />
            <div className="max-h-[560px] overflow-y-auto space-y-2 pr-1">
              {!searching && candidates.length === 0 && (
                <p className="text-muted-foreground text-sm">No films found.</p>
              )}
              {candidates.map((c) => {
                const alreadySelected = selectedIds.includes(c._id);
                return (
                  <div
                    key={c._id}
                    className="flex items-center gap-3 rounded border border-border bg-card/40 p-2.5"
                  >
                    <div className="h-11 w-8 rounded overflow-hidden bg-black shrink-0">
                      {thumbUrl(c) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbUrl(c)} alt="" className="h-full w-full object-cover" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm truncate">{c.title}</p>
                      {c.submission_year && (
                        <p className="text-muted-foreground text-xs">{c.submission_year}</p>
                      )}
                    </div>
                    <button
                      onClick={() => addFilm({ ...c, status: "APPROVED" })}
                      disabled={alreadySelected || full}
                      className="shrink-0 p-1.5 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Add to featured films"
                    >
                      {alreadySelected ? <span className="text-xs px-1">Added</span> : <Plus size={14} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
