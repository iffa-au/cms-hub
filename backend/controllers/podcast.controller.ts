import { Request, Response } from "express";
import Podcast from "../models/podcast.model.js";

/**
 * Podcast episodes.
 *
 * Shape follows festival.controller.ts: public read + staff CRUD, the same
 * { success, data, message } envelope, and the same rule that a literal route
 * is registered before `/:id`.
 *
 * No S3 anywhere. A podcast owns no uploaded asset — its artwork is either the
 * YouTube thumbnail or a URL an editor pasted — so there is no orphan cleanup
 * to get wrong on update and no cascade delete to get wrong on remove.
 */

const PUBLIC_FIELDS = {
  slug: 1,
  title: 1,
  excerpt: 1,
  description: 1,
  youtubeUrl: 1,
  youtubeVideoId: 1,
  thumbnailUrl: 1,
  category: 1,
  host: 1,
  guests: 1,
  episodeNumber: 1,
  durationMinutes: 1,
  relatedFestival: 1,
  publishedAt: 1,
  isFeatured: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

/** Newest first. Mirrors the compound index on the model. */
const PUBLIC_SORT = { publishedAt: -1, _id: -1 } as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Every YouTube id is exactly 11 url-safe characters. */
const VIDEO_ID = /^[\w-]{11}$/;

/** Mirrors the slugify in festival.controller.ts — this ends up in /podcast/<slug>. */
const slugify = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 120);

/**
 * Pulls the video id out of whatever an editor pasted.
 *
 * Handled deliberately rather than with one regex over the raw string: the
 * share links YouTube hands out differ by surface (`youtu.be` from the share
 * sheet, `/watch?v=` from the address bar, `/live/` from a streamed episode)
 * and a bare id is what someone types when they already know it. Returns null
 * for anything else so the write fails loudly at the CMS instead of storing a
 * record whose player renders an empty black box on the public site.
 */
export const extractYouTubeId = (raw: string): string | null => {
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

/** Blank entries dropped — an empty guest renders as a stray separator. */
const nameList = (raw: unknown, fallback: string[]): string[] =>
  Array.isArray(raw)
    ? raw.map((name) => String(name ?? "").trim()).filter(Boolean).slice(0, 20)
    : fallback;

const wholeNumber = (raw: unknown): number => {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
};

/**
 * Clears the featured flag on every episode except `keepId`.
 *
 * "Featured" is singular on the public page, so it is made singular here rather
 * than left to the reader to resolve. Doing it in the database also means an
 * editor who features a second episode does not have to remember to un-feature
 * the first — which is the step that would get forgotten, and which would show
 * up as a page that ignores the choice they just made.
 *
 * Runs after the episode's own write, never before: a failure here leaves two
 * episodes flagged, which the public page resolves by publish date, whereas the
 * reverse order could clear the existing hero and then fail to set the new one,
 * leaving the page with no featured episode at all.
 */
const clearOtherFeatured = async (keepId: unknown) => {
  await Podcast.updateMany(
    { _id: { $ne: keepId }, isFeatured: true },
    { $set: { isFeatured: false } },
  );
};

/* ------------------------------- public ------------------------------- */

/**
 * Public API: published episodes, newest first.
 *
 * Returns the whole list rather than paginating. The public page needs the
 * newest one for its hero *and* the rest for its archive in a single render,
 * and the collection is a handful of episodes — a second round trip to a cold
 * App Runner instance would cost more than the payload ever will.
 */
export const fetchPodcasts = async (req: Request, res: Response) => {
  try {
    const limit = wholeNumber(req.query.limit);
    const query = Podcast.find({ isPublished: true }, PUBLIC_FIELDS).sort(PUBLIC_SORT);
    if (limit) query.limit(Math.min(limit, 100));

    const podcasts = await query.lean();
    res.status(200).json({ success: true, data: podcasts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/** Public API: one published episode, for /podcast/<slug>. */
export const fetchPodcastBySlug = async (req: Request, res: Response) => {
  try {
    const podcast = await Podcast.findOne(
      { slug: String(req.params.slug || "").toLowerCase(), isPublished: true },
      PUBLIC_FIELDS,
    ).lean();

    if (!podcast) {
      return res.status(404).json({ success: false, message: "Podcast not found" });
    }
    res.status(200).json({ success: true, data: podcast });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* -------------------------------- staff ------------------------------- */

/** Staff-only: includes drafts, so an unpublished episode can be found again. */
export const listPodcasts = async (_req: Request, res: Response) => {
  try {
    const podcasts = await Podcast.find({}).sort(PUBLIC_SORT).lean();
    res.status(200).json({ success: true, data: podcasts });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getPodcastById = async (req: Request, res: Response) => {
  try {
    const podcast = await Podcast.findById(req.params.id).lean();
    if (!podcast) {
      return res.status(404).json({ success: false, message: "Podcast not found" });
    }
    res.status(200).json({ success: true, data: podcast });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createPodcast = async (req: Request, res: Response) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;

    const title = String(body.title ?? "").trim();
    if (!title) {
      return res.status(400).json({ success: false, message: "Title is required" });
    }

    const youtubeUrl = String(body.youtubeUrl ?? "").trim();
    const youtubeVideoId = extractYouTubeId(youtubeUrl);
    if (!youtubeVideoId) {
      return res.status(400).json({
        success: false,
        message:
          "A YouTube link is required, and this one could not be read. Paste the watch, share or embed URL.",
      });
    }

    const publishedAt = String(body.publishedAt ?? "").trim();
    if (!ISO_DATE.test(publishedAt)) {
      return res.status(400).json({
        success: false,
        message: "publishedAt is required, in YYYY-MM-DD form",
      });
    }

    const slug = slugify(String(body.slug ?? "") || title);
    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Could not build a URL slug from that title — set one manually",
      });
    }

    const clash = await Podcast.findOne({ slug }).select("_id title").lean();
    if (clash) {
      return res.status(409).json({
        success: false,
        message: `The slug "${slug}" is already used by "${clash.title}". Choose a different one.`,
      });
    }

    const created = await Podcast.create({
      slug,
      title,
      excerpt: String(body.excerpt ?? "").trim(),
      description: String(body.description ?? "").trim(),
      youtubeUrl,
      youtubeVideoId,
      thumbnailUrl: String(body.thumbnailUrl ?? "").trim(),
      category: String(body.category ?? "").trim(),
      host: String(body.host ?? "").trim(),
      guests: nameList(body.guests, []),
      episodeNumber: wholeNumber(body.episodeNumber),
      durationMinutes: wholeNumber(body.durationMinutes),
      relatedFestival: String(body.relatedFestival ?? "").trim(),
      publishedAt,
      isPublished: body.isPublished === undefined ? false : !!body.isPublished,
      isFeatured: !!body.isFeatured,
    });

    if (created.isFeatured) await clearOtherFeatured(created._id);

    res.status(201).json({ success: true, message: "Podcast created", data: created });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updatePodcast = async (req: Request, res: Response) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const existing = await Podcast.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Podcast not found" });
    }

    const updates: Record<string, unknown> = {};

    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) {
        return res.status(400).json({ success: false, message: "Title cannot be empty" });
      }
      updates.title = title;
    }

    if (body.slug !== undefined) {
      const slug = slugify(String(body.slug));
      if (!slug) {
        return res.status(400).json({ success: false, message: "Slug cannot be empty" });
      }
      if (slug !== existing.slug) {
        const clash = await Podcast.findOne({ slug, _id: { $ne: existing._id } })
          .select("_id title")
          .lean();
        if (clash) {
          return res.status(409).json({
            success: false,
            message: `The slug "${slug}" is already used by "${clash.title}". Choose a different one.`,
          });
        }
      }
      updates.slug = slug;
    }

    // Re-parsed rather than carried over: the stored id must always be the one
    // this URL resolves to, or an editor fixing a wrong link would leave the
    // old video embedded under the new URL.
    if (body.youtubeUrl !== undefined) {
      const youtubeUrl = String(body.youtubeUrl).trim();
      const youtubeVideoId = extractYouTubeId(youtubeUrl);
      if (!youtubeVideoId) {
        return res.status(400).json({
          success: false,
          message:
            "That YouTube link could not be read. Paste the watch, share or embed URL.",
        });
      }
      updates.youtubeUrl = youtubeUrl;
      updates.youtubeVideoId = youtubeVideoId;
    }

    if (body.publishedAt !== undefined) {
      const publishedAt = String(body.publishedAt).trim();
      if (!ISO_DATE.test(publishedAt)) {
        return res
          .status(400)
          .json({ success: false, message: "publishedAt must be in YYYY-MM-DD form" });
      }
      updates.publishedAt = publishedAt;
    }

    if (body.excerpt !== undefined) updates.excerpt = String(body.excerpt).trim();
    if (body.description !== undefined) updates.description = String(body.description).trim();
    if (body.thumbnailUrl !== undefined) updates.thumbnailUrl = String(body.thumbnailUrl).trim();
    if (body.category !== undefined) updates.category = String(body.category).trim();
    if (body.host !== undefined) updates.host = String(body.host).trim();
    if (body.guests !== undefined) updates.guests = nameList(body.guests, existing.guests);
    if (body.episodeNumber !== undefined) updates.episodeNumber = wholeNumber(body.episodeNumber);
    if (body.durationMinutes !== undefined) {
      updates.durationMinutes = wholeNumber(body.durationMinutes);
    }
    if (body.relatedFestival !== undefined) {
      updates.relatedFestival = String(body.relatedFestival).trim();
    }
    if (body.isPublished !== undefined) updates.isPublished = !!body.isPublished;
    if (body.isFeatured !== undefined) updates.isFeatured = !!body.isFeatured;

    const updated = await Podcast.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true },
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "Podcast not found" });
    }

    if (updated.isFeatured) await clearOtherFeatured(updated._id);

    res.status(200).json({ success: true, message: "Podcast updated", data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const deletePodcast = async (req: Request, res: Response) => {
  try {
    const deleted = await Podcast.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Podcast not found" });
    }
    console.log(`Deleted podcast "${deleted.title}" (${deleted.slug}).`);
    res.status(200).json({ success: true, message: "Podcast deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
