"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/providers/auth-context";
import { getData, updateData } from "@/lib/fetch-util";
import { ArrowLeft, ExternalLink } from "lucide-react";

/**
 * One podcast episode.
 *
 * The YouTube link is the field this screen is really built around. It is the
 * only input whose mistakes are invisible from the CMS — a wrong-but-valid URL
 * saves fine and produces a page with the wrong conversation on it — so the
 * link is parsed as it is typed and the resulting thumbnail is shown back. If
 * the picture is the wrong episode, the link is the wrong episode.
 *
 * The server parses it again on save and is the authority; this preview exists
 * to make a bad paste obvious before it is stored, not to be trusted.
 */

type PodcastResponse = {
  success: boolean;
  message?: string;
  data: {
    _id: string;
    slug: string;
    title: string;
    excerpt?: string;
    description?: string;
    youtubeUrl: string;
    youtubeVideoId: string;
    thumbnailUrl?: string;
    category?: string;
    host?: string;
    guests?: string[];
    episodeNumber?: number;
    durationMinutes?: number;
    relatedFestival?: string;
    publishedAt: string;
    isPublished?: boolean;
    isFeatured?: boolean;
    updatedAt?: string;
  };
};

const VIDEO_ID = /^[\w-]{11}$/;

/** Client-side twin of extractYouTubeId in podcast.controller.ts. */
const extractYouTubeId = (raw: string): string | null => {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (VIDEO_ID.test(value)) return value;

  let parsed: URL;
  try {
    parsed = new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const segments = parsed.pathname.split("/").filter(Boolean);

  const candidate = (() => {
    if (host === "youtu.be") return segments[0];
    if (!/(^|\.)(youtube\.com|youtube-nocookie\.com)$/.test(host)) return undefined;
    if (segments[0] === "watch") return parsed.searchParams.get("v") ?? undefined;
    if (["embed", "shorts", "live", "v"].includes(segments[0] ?? "")) return segments[1];
    return parsed.searchParams.get("v") ?? undefined;
  })();

  return candidate && VIDEO_ID.test(candidate) ? candidate : null;
};

const errorMessage = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : fallback;

const field =
  "w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground";
const labelClass = "mb-1 block text-xs text-muted-foreground";

export default function PodcastEditorPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const podcastId = params?.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [publishedAt, setPublishedAt] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [host, setHost] = useState("");
  const [guests, setGuests] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [relatedFestival, setRelatedFestival] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user?.role !== "admin" && user?.role !== "staff") {
      router.replace("/");
    }
  }, [isAuthenticated, user, router]);

  const load = useCallback(async () => {
    if (!podcastId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getData<PodcastResponse>(`/podcasts/manage/${podcastId}`);
      const podcast = res?.data;
      if (!podcast) throw new Error("Podcast not found");

      setTitle(podcast.title ?? "");
      setSlug(podcast.slug ?? "");
      setYoutubeUrl(podcast.youtubeUrl ?? "");
      setPublishedAt(podcast.publishedAt ?? "");
      setExcerpt(podcast.excerpt ?? "");
      setDescription(podcast.description ?? "");
      setCategory(podcast.category ?? "");
      setHost(podcast.host ?? "");
      setGuests((podcast.guests ?? []).join(", "));
      setEpisodeNumber(podcast.episodeNumber ? String(podcast.episodeNumber) : "");
      setDurationMinutes(podcast.durationMinutes ? String(podcast.durationMinutes) : "");
      setRelatedFestival(podcast.relatedFestival ?? "");
      setThumbnailUrl(podcast.thumbnailUrl ?? "");
      setIsPublished(!!podcast.isPublished);
      setIsFeatured(!!podcast.isFeatured);
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to load podcast"));
    } finally {
      setLoading(false);
    }
  }, [podcastId]);

  useEffect(() => {
    void load();
  }, [load]);

  const videoId = useMemo(() => extractYouTubeId(youtubeUrl), [youtubeUrl]);

  const handleSave = async () => {
    if (!podcastId) return;
    if (!title.trim()) {
      setError("Give the episode a title before saving.");
      return;
    }
    if (!videoId) {
      setError("That YouTube link could not be read — paste the watch, share or embed URL.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await updateData(`/podcasts/${podcastId}`, {
        title: title.trim(),
        slug: slug.trim() || title.trim(),
        youtubeUrl: youtubeUrl.trim(),
        publishedAt,
        excerpt: excerpt.trim(),
        description,
        category: category.trim(),
        host: host.trim(),
        guests: guests.split(",").map((name) => name.trim()).filter(Boolean),
        episodeNumber: episodeNumber ? Number(episodeNumber) : 0,
        durationMinutes: durationMinutes ? Number(durationMinutes) : 0,
        relatedFestival: relatedFestival.trim(),
        thumbnailUrl: thumbnailUrl.trim(),
        isPublished,
        isFeatured,
      });
      // Says which of the two things just happened. A bare "Saved." on a draft
      // reads as "it is on the website now", and the next thing you do is go
      // look at the site and find nothing there.
      setSuccess(
        !isPublished
          ? "Saved as a draft — tick Published above to put it on the website."
          : isFeatured
            ? "Saved. This episode now leads the podcast page."
            : "Saved and live on the website.",
      );
      await load();
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to save podcast"));
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) return null;
  if (isAuthenticated && user?.role !== "admin" && user?.role !== "staff") return null;

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-8 w-48 animate-pulse rounded bg-card/60" />
        <div className="mt-6 h-64 animate-pulse rounded bg-card/60" />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/podcasts"
        className="mb-6 inline-flex items-center gap-2 text-xs font-bold tracking-widest text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft size={14} /> ALL EPISODES
      </Link>

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <h1 className="font-serif text-3xl text-white md:text-4xl">Edit episode</h1>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-xs tracking-widest text-muted-foreground">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="h-4 w-4 accent-white"
            />
            PUBLISHED
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-xs tracking-widest text-muted-foreground">
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
              className="h-4 w-4 accent-white"
            />
            FEATURED
          </label>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded bg-primary px-5 py-2 text-xs font-bold tracking-widest text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "SAVING..." : "SAVE"}
          </button>
        </div>
      </div>

      <p className="mb-6 text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Featured</strong> puts this episode at the
        top of the podcast page. Only one episode can hold it — ticking it here releases
        it from whichever episode has it now. Untick every episode and the page leads
        with the most recent one instead.
      </p>

      {isFeatured && !isPublished && (
        <p className="mb-4 rounded border border-yellow-400/30 bg-yellow-400/10 px-4 py-2 text-sm text-yellow-500">
          This episode is set as featured but is still a draft, so the website cannot
          show it. Until it is published the page will lead with the newest published
          episode instead.
        </p>
      )}

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

      <div className="space-y-8">
        {/* -------------------------------- video ------------------------------- */}
        <section className="rounded border border-border bg-card/40 p-5">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            The video
          </h2>

          <label className={labelClass} htmlFor="youtubeUrl">
            YouTube link
          </label>
          <input
            id="youtubeUrl"
            className={field}
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />

          <div className="mt-4 flex flex-col gap-4 sm:flex-row">
            <div className="h-[90px] w-40 shrink-0 overflow-hidden rounded bg-black/40">
              {videoId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
                  alt="Video thumbnail"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-2 text-center text-[10px] text-muted-foreground">
                  No video
                </div>
              )}
            </div>
            <div className="min-w-0 text-xs text-muted-foreground">
              {videoId ? (
                <>
                  <p className="text-green-400">Link reads as video {videoId}.</p>
                  <p className="mt-1">
                    Check the thumbnail is the right conversation — a valid link to the
                    wrong video saves without complaint.
                  </p>
                  <a
                    href={`https://www.youtube.com/watch?v=${videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-primary hover:underline"
                  >
                    Open on YouTube <ExternalLink size={11} />
                  </a>
                </>
              ) : (
                <p className="text-red-400">
                  This link cannot be read as a YouTube video. Watch, share (youtu.be),
                  embed, shorts and live URLs all work — as does a bare 11-character
                  video id.
                </p>
              )}
              <p className="mt-3">
                The episode plays inside the IFFA site. Visitors are never sent to
                YouTube.
              </p>
            </div>
          </div>
        </section>

        {/* -------------------------------- copy -------------------------------- */}
        <section className="rounded border border-border bg-card/40 p-5">
          <h2 className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Episode
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="title">
                Title
              </label>
              <input
                id="title"
                className={field}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="slug">
                URL slug
              </label>
              <input
                id="slug"
                className={field}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                /podcast/{slug || "…"} — changing this breaks existing links.
              </p>
            </div>

            <div>
              <label className={labelClass} htmlFor="publishedAt">
                Publish date
              </label>
              <input
                id="publishedAt"
                type="date"
                className={field}
                value={publishedAt}
                onChange={(e) => setPublishedAt(e.target.value)}
              />
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                Decides the order on the site. The newest published episode is the hero.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="excerpt">
                Short description
              </label>
              <textarea
                id="excerpt"
                rows={2}
                className={field}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                placeholder="One or two sentences. Used on cards and under the hero."
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="description">
                Full description
              </label>
              <textarea
                id="description"
                rows={10}
                className={field}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  "The episode write-up, shown under the video on its own page.\n\nLeave a blank line between paragraphs — the site renders each one separately."
                }
              />
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                Plain text. Blank lines become paragraphs.
              </p>
            </div>
          </div>
        </section>

        {/* ------------------------------ metadata ------------------------------ */}
        <section className="rounded border border-border bg-card/40 p-5">
          <h2 className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Details
          </h2>
          <p className="mb-4 text-[11px] text-muted-foreground/70">
            All optional. Anything left blank is left off the page rather than shown
            empty.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass} htmlFor="category">
                Category
              </label>
              <input
                id="category"
                className={field}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Behind the Film"
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="episodeNumber">
                Episode number
              </label>
              <input
                id="episodeNumber"
                type="number"
                min={0}
                className={field}
                value={episodeNumber}
                onChange={(e) => setEpisodeNumber(e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="host">
                Host
              </label>
              <input
                id="host"
                className={field}
                value={host}
                onChange={(e) => setHost(e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="guests">
                Guests
              </label>
              <input
                id="guests"
                className={field}
                value={guests}
                onChange={(e) => setGuests(e.target.value)}
                placeholder="Separate names with commas"
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="durationMinutes">
                Duration (minutes)
              </label>
              <input
                id="durationMinutes"
                type="number"
                min={0}
                className={field}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(e.target.value)}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="relatedFestival">
                Related festival
              </label>
              <input
                id="relatedFestival"
                className={field}
                value={relatedFestival}
                onChange={(e) => setRelatedFestival(e.target.value)}
                placeholder="AIFFA 2026"
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="thumbnailUrl">
                Custom artwork URL
              </label>
              <input
                id="thumbnailUrl"
                className={field}
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="Leave blank to use the YouTube thumbnail"
              />
              <p className="mt-1 text-[10px] text-muted-foreground/70">
                Only needed when the site should show different artwork from the one on
                YouTube. Must be a full https:// link.
              </p>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="rounded bg-primary px-6 py-2.5 text-xs font-bold tracking-widest text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "SAVING..." : "SAVE"}
        </button>
      </div>
    </main>
  );
}
