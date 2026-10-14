import { Request, Response } from "express";
import HomepageTrailers, {
  MAX_HOMEPAGE_TRAILERS,
  MAX_VISIBLE_TRAILERS,
  type IHomepageTrailerEntry,
} from "../models/homepageTrailers.model.js";
import {
  buildPublicUrl,
  deleteUploadedObject,
  describeS3Failure,
  headUploadedObject,
  isTrailerKey,
  MAX_TRAILER_BYTES,
  S3ConfigError,
  S3VerifyError,
  TRAILER_CONTENT_TYPE,
} from "../libs/s3.js";

/**
 * Homepage trailers — see homepageTrailers.model.ts.
 *
 * Shape follows featuredFilms.controller.ts (public read never creates the
 * singleton; staff replace the whole list in one write) and
 * festival.controller.ts (S3 keys the write stopped referencing are deleted
 * after the write, never before, best-effort).
 */

export class TrailerInputError extends Error {}

const text = (value: unknown) => String(value ?? "").trim();

const isHttpUrl = (value: string) => {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

/** A site path ("/oman") or a full http(s) URL. "//host" is protocol-relative — refused. */
const isLink = (value: string) =>
  (value.startsWith("/") && !value.startsWith("//")) || isHttpUrl(value);

type Head = typeof headUploadedObject;

/**
 * Validates the CMS payload against what is already stored, and returns the
 * entries to write. Throws TrailerInputError with a message naming the trailer.
 *
 * `videoUrl` is never taken from the client for an uploaded file: it is
 * rebuilt from the key. A keyless entry may only keep a URL the document
 * already holds — that is how the imported HLS trailers survive a save, and
 * why nobody can paste an arbitrary external video in.
 */
export async function normaliseEntries(
  raw: unknown,
  previous: IHomepageTrailerEntry[],
  head: Head = headUploadedObject,
): Promise<IHomepageTrailerEntry[]> {
  if (!Array.isArray(raw)) throw new TrailerInputError("entries must be a list");
  if (raw.length > MAX_HOMEPAGE_TRAILERS) {
    throw new TrailerInputError(`At most ${MAX_HOMEPAGE_TRAILERS} trailers`);
  }

  const previousKeys = new Set(previous.map((e) => e.videoKey).filter(Boolean));
  const previousKeylessUrls = new Set(
    previous.filter((e) => !e.videoKey).map((e) => e.videoUrl),
  );

  const entries: IHomepageTrailerEntry[] = [];
  for (const [index, item] of raw.entries()) {
    const row = (item ?? {}) as Record<string, unknown>;
    const title = text(row.title);
    if (!title) throw new TrailerInputError(`Trailer ${index + 1} needs a title`);
    if (title.length > 120) {
      throw new TrailerInputError(`"${title.slice(0, 40)}…": title is longer than 120 characters`);
    }

    const videoKey = text(row.videoKey);
    let videoUrl: string;
    if (videoKey) {
      if (!isTrailerKey(videoKey)) {
        throw new TrailerInputError(`"${title}": that video was not uploaded through the CMS`);
      }
      if (!previousKeys.has(videoKey)) {
        const found = await head(videoKey);
        if (!found) {
          throw new TrailerInputError(`"${title}": the video upload did not finish — upload it again`);
        }
        if (found.contentType !== TRAILER_CONTENT_TYPE) {
          throw new TrailerInputError(`"${title}": the uploaded file is not an MP4`);
        }
      }
      videoUrl = buildPublicUrl(videoKey);
    } else {
      videoUrl = text(row.videoUrl);
      if (!previousKeylessUrls.has(videoUrl)) {
        throw new TrailerInputError(`"${title}" has no video — upload an MP4`);
      }
    }

    const youtubeUrl = text(row.youtubeUrl);
    if (youtubeUrl && !isHttpUrl(youtubeUrl)) {
      throw new TrailerInputError(`"${title}": the Watch Trailer link must start with https://`);
    }
    const learnMoreUrl = text(row.learnMoreUrl);
    if (learnMoreUrl && !isLink(learnMoreUrl)) {
      throw new TrailerInputError(
        `"${title}": the Learn More link must be a site path like /oman or a full https:// URL`,
      );
    }

    entries.push({ title, videoUrl, videoKey, youtubeUrl, learnMoreUrl, isHidden: row.isHidden === true });
  }

  const visible = entries.filter((e) => !e.isHidden).length;
  if (visible > MAX_VISIBLE_TRAILERS) {
    throw new TrailerInputError(
      `The homepage has ${MAX_VISIBLE_TRAILERS} trailer slots — hide or remove ${visible - MAX_VISIBLE_TRAILERS}`,
    );
  }
  return entries;
}

/**
 * Keys referenced before a save and by nothing after it. A key another entry
 * still uses is in `after`, so it can never be returned — that is the whole
 * "don't delete a file still in use" guarantee. Keyless (imported) entries
 * contribute nothing, so their HLS folders are never touched.
 */
export function cleanupKeys(
  before: IHomepageTrailerEntry[],
  after: IHomepageTrailerEntry[],
): string[] {
  const kept = new Set(after.map((e) => e.videoKey).filter(Boolean));
  return [...new Set(before.map((e) => e.videoKey).filter(Boolean))].filter(
    (key) => !kept.has(key) && isTrailerKey(key),
  );
}

const toManage = (e: IHomepageTrailerEntry) => ({
  _id: String(e._id ?? ""),
  title: e.title,
  videoUrl: e.videoUrl,
  videoKey: e.videoKey ?? "",
  youtubeUrl: e.youtubeUrl ?? "",
  learnMoreUrl: e.learnMoreUrl ?? "",
  isHidden: !!e.isHidden,
});

/* ------------------------------- public ------------------------------- */

export const fetchHomepageTrailers = async (_req: Request, res: Response) => {
  try {
    const doc = await HomepageTrailers.findOne().lean();
    if (!doc) return res.status(200).json({ success: true, configured: false, data: [] });

    const data = doc.entries
      .filter((e) => !e.isHidden)
      .slice(0, MAX_VISIBLE_TRAILERS)
      .map((e) => ({
        id: String(e._id),
        title: e.title,
        videoUrl: e.videoUrl,
        youtubeUrl: e.youtubeUrl ?? "",
        learnMoreUrl: e.learnMoreUrl ?? "",
      }));
    res.status(200).json({ success: true, configured: true, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* -------------------------------- staff ------------------------------- */

export const getHomepageTrailersForManage = async (_req: Request, res: Response) => {
  try {
    const doc = await HomepageTrailers.findOne().lean();
    res.status(200).json({
      success: true,
      data: (doc?.entries ?? []).map(toManage),
      updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
      limits: {
        maxEntries: MAX_HOMEPAGE_TRAILERS,
        maxVisible: MAX_VISIBLE_TRAILERS,
        maxBytes: MAX_TRAILER_BYTES,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const STALE =
  "Someone else changed the homepage trailers since you opened this page. Reload to see their changes, then make yours again.";

export const setHomepageTrailers = async (req: Request, res: Response) => {
  try {
    const body = (req.body ?? {}) as { entries?: unknown; updatedAt?: unknown };
    const existing = await HomepageTrailers.findOne();
    const storedStamp = existing?.updatedAt ? existing.updatedAt.toISOString() : null;
    const sentStamp = typeof body.updatedAt === "string" ? body.updatedAt : null;
    if (storedStamp !== sentStamp) {
      return res.status(409).json({ success: false, message: STALE });
    }

    const previous = existing?.entries ?? [];
    const entries = await normaliseEntries(body.entries, previous);

    let saved;
    if (existing) {
      // Conditional on the stamp we checked: a save landing between the check
      // above and this write makes the filter miss, and we answer 409 instead
      // of silently overwriting it.
      saved = await HomepageTrailers.findOneAndUpdate(
        { _id: existing._id, updatedAt: existing.updatedAt },
        { $set: { entries } },
        { new: true, runValidators: true },
      );
      if (!saved) return res.status(409).json({ success: false, message: STALE });
    } else {
      saved = await HomepageTrailers.create({ entries });
    }

    // After the write, never before: a failed cleanup must not undo the edit.
    for (const key of cleanupKeys(previous, saved.entries)) {
      await deleteUploadedObject(key);
    }

    res.status(200).json({
      success: true,
      message: "Homepage trailers updated",
      data: saved.entries.map(toManage),
      updatedAt: saved.updatedAt!.toISOString(),
    });
  } catch (error) {
    if (error instanceof TrailerInputError) {
      return res.status(400).json({ success: false, message: error.message });
    }
    // Unique index on `singleton`: two first saves raced.
    if ((error as { code?: number })?.code === 11000) {
      return res.status(409).json({ success: false, message: STALE });
    }
    console.error(error);
    if (error instanceof S3ConfigError || error instanceof S3VerifyError) {
      return res.status(500).json({ success: false, message: error.message });
    }
    const explained = describeS3Failure(error);
    if (explained) return res.status(500).json({ success: false, message: explained });
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
