"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-context";
import { getData, updateData } from "@/lib/fetch-util";
import { GripVertical, Plus, X, ChevronUp, ChevronDown } from "lucide-react";

type Candidate = {
  _id: string;
  title: string;
  potraitImageUrl?: string;
  landscapeImageUrl?: string;
  submission_year?: number;
  isFeatured?: boolean;
  featuredOrder?: number;
};

type ListResponse = {
  success: boolean;
  data: Candidate[];
  message?: string;
};

const MAX_SLOTS = 5;

const thumbUrl = (c: Candidate) => c.potraitImageUrl || c.landscapeImageUrl || "";

export default function CarouselManagementPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user?.role !== "admin" && user?.role !== "staff") {
      router.replace("/");
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await getData<ListResponse>("/submissions/carousel");
        if (cancelled) return;
        const items = res?.data ?? [];
        setCandidates(items);
        const featured = items
          .filter((c) => c.isFeatured)
          .sort((a, b) => (a.featuredOrder ?? 99) - (b.featuredOrder ?? 99))
          .map((c) => c._id);
        setSelectedIds(featured);
      } catch (e: unknown) {
        if (!cancelled) {
          const message =
            e instanceof Error ? e.message : "Failed to load submissions";
          setError(message);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const byId = useMemo(() => {
    const map = new Map<string, Candidate>();
    for (const c of candidates) map.set(c._id, c);
    return map;
  }, [candidates]);

  const filteredCandidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => c.title.toLowerCase().includes(q));
  }, [candidates, query]);

  const addFilm = (id: string) => {
    setSuccess(null);
    if (selectedIds.includes(id) || selectedIds.length >= MAX_SLOTS) return;
    setSelectedIds((prev) => [...prev, id]);
  };

  const removeFilm = (id: string) => {
    setSuccess(null);
    setSelectedIds((prev) => prev.filter((sid) => sid !== id));
  };

  const move = (index: number, direction: -1 | 1) => {
    setSuccess(null);
    setSelectedIds((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await updateData("/submissions/carousel", { submissionIds: selectedIds });
      setSuccess("Carousel updated — changes are live on the public site now.");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save carousel";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) return null;
  if (isAuthenticated && user?.role !== "admin" && user?.role !== "staff") return null;

  return (
    <main className="flex-1 py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="font-serif text-3xl md:text-4xl text-white mb-2">
          Carousel Management
        </h1>
        <p className="text-accent-foreground text-sm">
          Pick up to {MAX_SLOTS} approved films to feature in the hero carousel at the top
          of the public submissions page. Order here is the order they play in.
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
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-8">
          {/* Selected slots */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">
              Selected ({selectedIds.length}/{MAX_SLOTS})
            </h2>
            <div className="space-y-2">
              {Array.from({ length: MAX_SLOTS }).map((_, i) => {
                const id = selectedIds[i];
                const film = id ? byId.get(id) : undefined;
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded border border-border bg-card/60 p-3 min-h-[76px]"
                  >
                    <span className="text-lg font-serif text-primary w-6 text-center shrink-0">
                      {i + 1}
                    </span>
                    {film ? (
                      <>
                        <GripVertical size={16} className="text-muted-foreground shrink-0" />
                        <div className="h-12 w-9 rounded overflow-hidden bg-black shrink-0">
                          {thumbUrl(film) ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={thumbUrl(film)}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-white text-sm font-semibold truncate">
                            {film.title}
                          </p>
                          {film.submission_year && (
                            <p className="text-muted-foreground text-xs">
                              {film.submission_year}
                            </p>
                          )}
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
                            disabled={i === selectedIds.length - 1}
                            className="p-1 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Move down"
                          >
                            <ChevronDown size={16} />
                          </button>
                          <button
                            onClick={() => removeFilm(film._id)}
                            className="p-1 text-muted-foreground hover:text-red-400"
                            aria-label="Remove from carousel"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="text-muted-foreground text-xs">Empty slot</p>
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
              {saving ? "SAVING..." : "SAVE CAROUSEL"}
            </button>
          </section>

          {/* Browse / add */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground mb-3">
              Approved Films
            </h2>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title..."
              className="w-full bg-card border border-border rounded px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 mb-3"
            />
            <div className="max-h-[560px] overflow-y-auto space-y-2 pr-1">
              {filteredCandidates.length === 0 && (
                <p className="text-muted-foreground text-sm">No films found.</p>
              )}
              {filteredCandidates.map((c) => {
                const alreadySelected = selectedIds.includes(c._id);
                const full = selectedIds.length >= MAX_SLOTS;
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
                      onClick={() => addFilm(c._id)}
                      disabled={alreadySelected || full}
                      className="shrink-0 p-1.5 rounded border border-border text-muted-foreground hover:text-primary hover:border-primary disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Add to carousel"
                    >
                      {alreadySelected ? <span className="text-[10px] px-1">Added</span> : <Plus size={14} />}
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
