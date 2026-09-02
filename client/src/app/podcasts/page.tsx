"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/providers/auth-context";
import { getData, postData, updateData, deleteData } from "@/lib/fetch-util";
import { Pencil, Trash2, Plus, Eye, EyeOff, Star } from "lucide-react";

/**
 * Podcast episodes for the CMS.
 *
 * "New episode" creates a draft immediately and opens its editor, the same way
 * the festivals index does — one less half-filled form to lose, and the record
 * exists before anything references it.
 *
 * The list is ordered exactly as the public page orders it (publishedAt, newest
 * first) so the row at the top is visibly the one that will be the site's hero.
 * That relationship is worth showing rather than explaining: it is the only
 * thing about this screen an editor can get wrong without being told.
 */

type Podcast = {
  _id: string;
  slug: string;
  title: string;
  youtubeVideoId: string;
  category?: string;
  episodeNumber?: number;
  publishedAt: string;
  isPublished?: boolean;
  isFeatured?: boolean;
};

type ListResponse = { success: boolean; data: Podcast[]; message?: string };
type CreateResponse = { success: boolean; data: Podcast; message?: string };

const errorMessage = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

const todayIso = () => new Date().toISOString().slice(0, 10);

/** "2026-09-02" -> "2 September 2026". Split by hand to dodge timezone drift. */
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const dateLabel = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return MONTHS[month - 1] ? `${day} ${MONTHS[month - 1]} ${year}` : "Undated";
};

export default function PodcastsAdminPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();

  const [podcasts, setPodcasts] = useState<Podcast[]>([]);
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
      const res = await getData<ListResponse>("/podcasts/manage");
      setPodcasts(res?.data ?? []);
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to load podcasts"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * The episode the public hero will actually show.
   *
   * The chosen one when there is one, otherwise the newest published episode —
   * the same fallback the website applies, so this badge never claims something
   * the visitor will not see. Drafts cannot win either branch: the public API
   * does not return them, so a featured draft loses to the newest published
   * episode exactly as it does on the site.
   */
  const published = podcasts.filter((podcast) => podcast.isPublished);
  const chosen = published.find((podcast) => podcast.isFeatured);
  const heroId = (chosen ?? published[0])?._id;
  const heroIsFallback = !chosen;

  const handleCreate = async () => {
    try {
      setCreating(true);
      setError(null);
      const res = await postData<CreateResponse>("/podcasts", {
        title: `Untitled episode ${new Date().toLocaleDateString()}`,
        // A real, embeddable placeholder rather than an empty string: the
        // backend rejects an unreadable link, and a draft has to exist before
        // the editor can open. Replaced on the first save.
        youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        publishedAt: todayIso(),
        isPublished: false,
      });
      if (!res?.data?._id) throw new Error(res?.message || "Could not create podcast");
      router.push(`/podcasts/${res.data._id}`);
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to create podcast"));
      setCreating(false);
    }
  };

  const togglePublished = async (podcast: Podcast) => {
    try {
      setError(null);
      await updateData(`/podcasts/${podcast._id}`, { isPublished: !podcast.isPublished });
      setSuccess(
        podcast.isPublished
          ? `"${podcast.title}" is now hidden from the website.`
          : `"${podcast.title}" is now live on the website.`,
      );
      await load();
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to update podcast"));
    }
  };

  const setFeatured = async (podcast: Podcast) => {
    try {
      setError(null);
      // Only ever sets. Clearing the flag everywhere else is the server's job —
      // doing it from here would be several round trips that can half-fail.
      await updateData(`/podcasts/${podcast._id}`, { isFeatured: true });
      setSuccess(
        podcast.isPublished
          ? `"${podcast.title}" now leads the podcast page.`
          : `"${podcast.title}" is set as featured, but it is still a draft — publish it for the website to show it.`,
      );
      await load();
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to update podcast"));
    }
  };

  const handleDelete = async (podcast: Podcast) => {
    const confirmed = window.confirm(
      `Delete "${podcast.title}"?\n\n` +
        `This removes the episode from the website. The video stays on YouTube — ` +
        `only the IFFA page for it goes away. This cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      setError(null);
      await deleteData(`/podcasts/${podcast._id}`);
      setSuccess(`"${podcast.title}" deleted.`);
      await load();
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to delete podcast"));
    }
  };

  if (!isAuthenticated) return null;
  if (isAuthenticated && user?.role !== "admin" && user?.role !== "staff") return null;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="mb-2 font-serif text-3xl text-white md:text-4xl">Podcast</h1>
          <p className="text-sm text-accent-foreground">
            Episodes shown on the public Podcast page. Only published episodes appear on
            the website. Star one to make it the featured episode at the top of the
            page; with none starred, the newest published episode leads instead.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => void handleCreate()}
            disabled={creating}
            className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-xs font-bold tracking-widest text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Plus size={14} /> {creating ? "CREATING..." : "NEW EPISODE"}
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
      ) : podcasts.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">
          No episodes yet. Use “New Episode” to publish the first conversation.
        </p>
      ) : (
        <div className="space-y-2">
          {podcasts.map((podcast) => (
            <div
              key={podcast._id}
              className="flex items-center gap-4 rounded border border-border bg-card/60 p-3"
            >
              <div className="hidden h-12 w-20 shrink-0 overflow-hidden rounded bg-black/40 sm:block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://i.ytimg.com/vi/${podcast.youtubeVideoId}/mqdefault.jpg`}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-semibold text-white">
                  {podcast.episodeNumber ? (
                    <span className="shrink-0 text-muted-foreground">
                      EP{String(podcast.episodeNumber).padStart(2, "0")}
                    </span>
                  ) : null}
                  {podcast.title}
                  {!podcast.isPublished && (
                    <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      Draft
                    </span>
                  )}
                  {podcast._id === heroId && (
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded border border-primary/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-primary"
                      title={
                        heroIsFallback
                          ? "No episode is starred, so the newest published one leads the page"
                          : "Starred — this episode leads the page"
                      }
                    >
                      <Star size={9} /> Featured{heroIsFallback ? " (default)" : ""}
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {dateLabel(podcast.publishedAt)}
                  {podcast.category ? ` · ${podcast.category}` : ""} · /podcast/
                  {podcast.slug}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => void setFeatured(podcast)}
                  disabled={!!podcast.isFeatured}
                  className="p-1.5 text-muted-foreground transition-colors hover:text-primary disabled:cursor-default disabled:text-primary"
                  aria-label={
                    podcast.isFeatured
                      ? `${podcast.title} is the featured episode`
                      : `Make ${podcast.title} the featured episode`
                  }
                  title={
                    podcast.isFeatured
                      ? "Featured episode"
                      : "Make this the featured episode"
                  }
                >
                  <Star size={15} className={podcast.isFeatured ? "fill-current" : ""} />
                </button>
                <button
                  onClick={() => void togglePublished(podcast)}
                  className="p-1.5 text-muted-foreground hover:text-primary"
                  aria-label={
                    podcast.isPublished
                      ? `Hide ${podcast.title} from the website`
                      : `Publish ${podcast.title} to the website`
                  }
                  title={
                    podcast.isPublished
                      ? "Published — click to hide"
                      : "Draft — click to publish"
                  }
                >
                  {podcast.isPublished ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <Link
                  href={`/podcasts/${podcast._id}`}
                  className="p-1.5 text-muted-foreground hover:text-primary"
                  aria-label={`Edit ${podcast.title}`}
                >
                  <Pencil size={15} />
                </Link>
                <button
                  onClick={() => void handleDelete(podcast)}
                  className="p-1.5 text-muted-foreground hover:text-red-400"
                  aria-label={`Delete ${podcast.title}`}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
