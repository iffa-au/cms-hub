import { randomUUID } from "crypto";
import { Request, Response } from "express";
import Festival, { SEAT_STATUSES, type IScreening } from "../models/festival.model.js";
import FestivalSettings from "../models/festivalSettings.model.js";
import {
  buildFestivalAssetPrefix,
  deleteUploadedObject,
  deleteUploadedPrefix,
  S3ConfigError,
} from "../libs/s3.js";

/**
 * Festivals and the Festivals page settings.
 *
 * Shape follows partner.controller.ts: public read + staff CRUD, same
 * { success, data, message } envelope, same rule that asset cleanup happens
 * after the database write and can never roll it back.
 */

const PUBLIC_FIELDS = {
  slug: 1,
  year: 1,
  name: 1,
  tagline: 1,
  description: 1,
  heroImageUrl: 1,
  city: 1,
  startDate: 1,
  endDate: 1,
  screenings: 1,
} as const;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Mirrors the slugify in libs/s3.ts, but for URL segments rather than object
 * keys: this value ends up in /festivals/<slug> on the public site.
 */
const slugify = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 100);

/**
 * The year a festival belongs to, taken from the day it opens.
 *
 * Always computed, never read from the request. `year` carries the unique
 * index that makes one-festival-a-year a rule rather than a convention, so
 * letting a client supply it would let a client choose which slot to occupy
 * independently of the dates it actually runs on.
 */
const yearOf = (startDate: string): number => Number(startDate.slice(0, 4));

/**
 * The festival already occupying a year, if there is one.
 *
 * Checked in the controller as well as by the unique index: the index is what
 * guarantees correctness under a race, and this is what turns the resulting
 * E11000 into a message that names the festival in the way.
 */
const festivalInYear = async (year: number, excludeId?: unknown) => {
  const query: Record<string, unknown> = { year };
  if (excludeId) query._id = { $ne: excludeId };
  return Festival.findOne(query).select("_id name slug year").lean();
};

const isSeatStatus = (value: unknown): boolean =>
  typeof value === "string" && (SEAT_STATUSES as readonly string[]).includes(value);

/**
 * Normalises one screening row from the CMS.
 *
 * Everything except title and date is optional and defaulted — a festival is
 * often announced before its full programme is confirmed, and a half-filled
 * screening is more useful on the page than no screening at all.
 */
const normaliseScreening = (raw: unknown): IScreening | { error: string } => {
  const row = (raw ?? {}) as Record<string, unknown>;

  const title = String(row.title ?? "").trim();
  if (!title) return { error: "Every screening needs a film title" };

  const date = String(row.date ?? "").trim();
  if (!ISO_DATE.test(date)) {
    return { error: `Screening "${title}" needs a date in YYYY-MM-DD form` };
  }

  const year = Number(row.year);
  const runtime = Number(row.runtimeMinutes);

  return {
    title,
    posterUrl: String(row.posterUrl ?? "").trim(),
    posterKey: String(row.posterKey ?? "").trim(),
    country: String(row.country ?? "").trim(),
    year: Number.isFinite(year) ? year : 0,
    genre: String(row.genre ?? "").trim(),
    runtimeMinutes: Number.isFinite(runtime) ? runtime : 0,
    synopsis: String(row.synopsis ?? "").trim(),
    trailerUrl: String(row.trailerUrl ?? "").trim(),
    date,
    time: String(row.time ?? "").trim(),
    venue: String(row.venue ?? "").trim(),
    seatStatus: isSeatStatus(row.seatStatus) ? (row.seatStatus as IScreening["seatStatus"]) : "available",
  };
};

const normaliseScreenings = (
  raw: unknown,
): { screenings: IScreening[] } | { error: string } => {
  if (raw === undefined) return { screenings: [] };
  if (!Array.isArray(raw)) return { error: "screenings must be a list" };

  const screenings: IScreening[] = [];
  for (const item of raw) {
    const result = normaliseScreening(item);
    if ("error" in result) return result;
    screenings.push(result);
  }
  return { screenings };
};

/** Every S3 key a festival owns — used to find what a write orphaned. */
const assetKeysOf = (festival: {
  heroImageKey?: string;
  screenings?: { posterKey?: string }[];
}): string[] =>
  [
    festival.heroImageKey,
    ...(festival.screenings ?? []).map((screening) => screening.posterKey),
  ]
    .map((key) => (key ?? "").trim())
    .filter(Boolean);

/**
 * The settings singleton, for read paths.
 *
 * Deliberately does NOT create the document: a public GET must never write to
 * the database, and the first visitor to the Festivals page should not be what
 * inserts a row in production. An unsaved instance already carries every schema
 * default, so a database with no settings document still renders a correct
 * page — the document appears the first time staff actually save one.
 */
const readFestivalSettings = async () => {
  const existing = await FestivalSettings.findOne().lean();
  return existing ?? new FestivalSettings().toObject();
};

/** The same singleton, for the staff write path — created if it is missing. */
const loadFestivalSettingsForWrite = async () =>
  (await FestivalSettings.findOne()) ?? new FestivalSettings();

/* ------------------------------- public ------------------------------- */

/**
 * Public API: published festivals in programme order, plus the page settings.
 *
 * Returned together because the page needs both to render one screen, and a
 * second round trip to a cold App Runner instance is the slowest part of the
 * public site's build.
 */
export const fetchFestivals = async (_req: Request, res: Response) => {
  try {
    const [festivals, settings] = await Promise.all([
      Festival.find({ isPublished: true }, PUBLIC_FIELDS).sort({ startDate: -1 }).lean(),
      readFestivalSettings(),
    ]);
    res.status(200).json({ success: true, data: { festivals, settings } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const fetchFestivalSettings = async (_req: Request, res: Response) => {
  try {
    const settings = await readFestivalSettings();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/** Public API: one published festival, for /festivals/<slug>. */
export const fetchFestivalBySlug = async (req: Request, res: Response) => {
  try {
    const festival = await Festival.findOne(
      { slug: String(req.params.slug || "").toLowerCase(), isPublished: true },
      PUBLIC_FIELDS,
    ).lean();

    if (!festival) {
      return res.status(404).json({ success: false, message: "Festival not found" });
    }
    res.status(200).json({ success: true, data: festival });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* -------------------------------- staff ------------------------------- */

/** Staff-only: includes drafts, so an unpublished festival can be found again. */
export const listFestivals = async (_req: Request, res: Response) => {
  try {
    const festivals = await Festival.find({}).sort({ startDate: -1 }).lean();
    res.status(200).json({ success: true, data: festivals });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getFestivalById = async (req: Request, res: Response) => {
  try {
    const festival = await Festival.findById(req.params.id).lean();
    if (!festival) {
      return res.status(404).json({ success: false, message: "Festival not found" });
    }
    res.status(200).json({ success: true, data: festival });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Creates the festival record — including its S3 folder name — before any
 * artwork exists.
 *
 * The CMS calls this as soon as an admin starts a new festival, then uploads
 * against the returned id. That ordering is what lets every presign resolve its
 * folder from the database instead of from a name the admin might still change.
 */
export const createFestival = async (req: Request, res: Response) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;

    const name = String(body.name ?? "").trim();
    if (!name) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }

    const startDate = String(body.startDate ?? "").trim();
    const endDate = String(body.endDate ?? "").trim();
    if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
      return res.status(400).json({
        success: false,
        message: "startDate and endDate are required, in YYYY-MM-DD form",
      });
    }
    if (endDate < startDate) {
      return res
        .status(400)
        .json({ success: false, message: "endDate cannot be before startDate" });
    }

    const year = yearOf(startDate);
    const occupied = await festivalInYear(year);
    if (occupied) {
      return res.status(409).json({
        success: false,
        message:
          `${year} already has a festival — "${occupied.name}". IFFA runs one festival a year, ` +
          `so edit that one instead, or move this festival's dates into a different year.`,
      });
    }

    const slug = slugify(String(body.slug ?? "") || name);
    if (!slug) {
      return res.status(400).json({
        success: false,
        message: "Could not build a URL slug from that name — set one manually",
      });
    }

    const clash = await Festival.findOne({ slug }).select("_id name").lean();
    if (clash) {
      return res.status(409).json({
        success: false,
        message: `The slug "${slug}" is already used by "${clash.name}". Choose a different one.`,
      });
    }

    const screeningResult = normaliseScreenings(body.screenings);
    if ("error" in screeningResult) {
      return res.status(400).json({ success: false, message: screeningResult.error });
    }

    // Server-generated, unlike the submit-film form's browser-generated ref:
    // this endpoint is authenticated and runs before any upload, so there is no
    // reason to trust the client with the token its folder is named after.
    const assetRef = randomUUID().replace(/-/g, "").slice(0, 8);

    const created = await Festival.create({
      slug,
      year,
      assetRef,
      assetPrefix: buildFestivalAssetPrefix(assetRef, name),
      name,
      tagline: String(body.tagline ?? "").trim(),
      description: String(body.description ?? "").trim(),
      heroImageUrl: String(body.heroImageUrl ?? "").trim(),
      heroImageKey: String(body.heroImageKey ?? "").trim(),
      city: String(body.city ?? "").trim(),
      startDate,
      endDate,
      isPublished: body.isPublished === undefined ? false : !!body.isPublished,
      screenings: screeningResult.screenings,
    });

    res.status(201).json({ success: true, message: "Festival created", data: created });
  } catch (error) {
    console.error(error);
    if (error instanceof S3ConfigError) {
      return res.status(500).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Updates a festival and cleans up whatever the edit orphaned.
 *
 * `assetPrefix` and `assetRef` are never taken from the request: the folder is
 * fixed at creation. S3 has no rename, so recomputing the prefix from an edited
 * name would point the record at a folder its files are not in, and the cascade
 * delete would then miss them entirely.
 */
export const updateFestival = async (req: Request, res: Response) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const existing = await Festival.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Festival not found" });
    }

    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return res.status(400).json({ success: false, message: "Name cannot be empty" });
      }
      updates.name = name;
    }

    if (body.slug !== undefined) {
      const slug = slugify(String(body.slug));
      if (!slug) {
        return res.status(400).json({ success: false, message: "Slug cannot be empty" });
      }
      if (slug !== existing.slug) {
        const clash = await Festival.findOne({ slug, _id: { $ne: existing._id } })
          .select("_id name")
          .lean();
        if (clash) {
          return res.status(409).json({
            success: false,
            message: `The slug "${slug}" is already used by "${clash.name}". Choose a different one.`,
          });
        }
      }
      updates.slug = slug;
    }

    const startDate =
      body.startDate !== undefined ? String(body.startDate).trim() : existing.startDate;
    const endDate =
      body.endDate !== undefined ? String(body.endDate).trim() : existing.endDate;

    if (!ISO_DATE.test(startDate) || !ISO_DATE.test(endDate)) {
      return res
        .status(400)
        .json({ success: false, message: "Dates must be in YYYY-MM-DD form" });
    }
    if (endDate < startDate) {
      return res
        .status(400)
        .json({ success: false, message: "endDate cannot be before startDate" });
    }
    if (body.startDate !== undefined) updates.startDate = startDate;
    if (body.endDate !== undefined) updates.endDate = endDate;

    // Moving a festival's dates can move it into another year, which is the
    // only way an edit can collide with the one-a-year rule. Recomputed on
    // every write rather than only when the dates change, so a record saved
    // before `year` existed picks it up the next time it is touched.
    const year = yearOf(startDate);
    if (year !== existing.year) {
      const occupied = await festivalInYear(year, existing._id);
      if (occupied) {
        return res.status(409).json({
          success: false,
          message:
            `${year} already has a festival — "${occupied.name}". IFFA runs one festival a year, ` +
            `so these dates would give ${year} two.`,
        });
      }
    }
    updates.year = year;

    if (body.tagline !== undefined) updates.tagline = String(body.tagline).trim();
    if (body.description !== undefined) updates.description = String(body.description).trim();
    if (body.city !== undefined) updates.city = String(body.city).trim();
    if (body.heroImageUrl !== undefined) updates.heroImageUrl = String(body.heroImageUrl).trim();
    if (body.heroImageKey !== undefined) updates.heroImageKey = String(body.heroImageKey).trim();
    if (body.isPublished !== undefined) updates.isPublished = !!body.isPublished;

    if (body.screenings !== undefined) {
      const screeningResult = normaliseScreenings(body.screenings);
      if ("error" in screeningResult) {
        return res.status(400).json({ success: false, message: screeningResult.error });
      }
      updates.screenings = screeningResult.screenings;
    }

    // Backfill for records created before assetPrefix existed (e.g. an early
    // seed). Uses the stored ref so the folder name stays stable.
    if (!existing.assetPrefix && existing.assetRef) {
      updates.assetPrefix = buildFestivalAssetPrefix(existing.assetRef, existing.name);
    }

    const keysBefore = new Set(assetKeysOf(existing));

    const updated = await Festival.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true },
    );
    if (!updated) {
      return res.status(404).json({ success: false, message: "Festival not found" });
    }

    // Whatever this edit stopped referencing — a replaced hero, a removed
    // screening, a swapped poster. Deliberately after the successful write: a
    // failed cleanup must never roll back or block the edit an admin asked for.
    const keysAfter = new Set(assetKeysOf(updated));
    const orphaned = [...keysBefore].filter((key) => !keysAfter.has(key));
    for (const key of orphaned) {
      await deleteUploadedObject(key);
    }

    res.status(200).json({ success: true, message: "Festival updated", data: updated });
  } catch (error) {
    console.error(error);
    if (error instanceof S3ConfigError) {
      return res.status(500).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Deletes a festival, its screenings, and every asset it owns.
 *
 * Order is deliberate: the document goes first. If S3 cleanup then fails — no
 * s3:ListBucket, no s3:DeleteObject, a network blip — the result is orphaned
 * objects, which are recoverable and cost pennies. The reverse order risks a
 * festival whose artwork is gone but which still renders on the public site.
 *
 * Two passes, because a festival can reference images it does not own: the
 * prefix delete clears its own folder, then any remaining key outside that
 * folder is deleted individually. Keys are empty for externally-hosted images
 * (the seeded festivals point at pre-existing CloudFront paths), and those are
 * left untouched — the same rule partner logos follow.
 */
export const deleteFestival = async (req: Request, res: Response) => {
  try {
    const deleted = await Festival.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: "Festival not found" });
    }

    const prefix = deleted.assetPrefix?.trim();
    let removed = 0;

    if (prefix) {
      try {
        removed = await deleteUploadedPrefix(prefix);
      } catch (error) {
        // A malformed prefix throws rather than deleting something broader.
        // Log it and carry on: the record is already gone.
        console.error(`Festival ${deleted._id} asset cleanup skipped:`, error);
      }
    }

    const strays = assetKeysOf(deleted).filter(
      (key) => !prefix || !key.startsWith(`${prefix}/`),
    );
    for (const key of strays) {
      await deleteUploadedObject(key);
    }

    console.log(
      `Deleted festival "${deleted.name}" (${deleted.slug}); removed ${removed} object(s) under ${prefix || "no prefix"}.`,
    );

    res.status(200).json({ success: true, message: "Festival deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* ------------------------------ settings ------------------------------ */

export const updateFestivalSettings = async (req: Request, res: Response) => {
  try {
    const body = (req.body || {}) as Record<string, unknown>;
    const settings = await loadFestivalSettingsForWrite();

    /** Uploaded images this edit stopped referencing. Deleted after the save. */
    const replacedKeys: string[] = [];

    const text = (value: unknown, fallback: string) =>
      value === undefined ? fallback : String(value).trim();

    /** Keeps the stored value when a section is absent from the request. */
    const section = (key: string): Record<string, unknown> =>
      (body[key] ?? {}) as Record<string, unknown>;

    const cta = (raw: unknown, fallback: { label: string; href: string }) => {
      const value = (raw ?? {}) as Record<string, unknown>;
      return {
        label: text(value.label, fallback.label),
        href: text(value.href, fallback.href),
      };
    };

    /** Blank entries are dropped rather than rendered as empty paragraphs. */
    const lines = (raw: unknown, fallback: string[]): string[] =>
      Array.isArray(raw)
        ? raw.map((line) => String(line ?? "").trim()).filter(Boolean)
        : fallback;

    settings.seriesLabel = text(body.seriesLabel, settings.seriesLabel);
    settings.city = text(body.city, settings.city);
    settings.country = text(body.country, settings.country);
    settings.planTitle = text(body.planTitle, settings.planTitle);
    settings.planBody = text(body.planBody, settings.planBody);
    settings.scheduleEyebrow = text(body.scheduleEyebrow, settings.scheduleEyebrow);
    settings.scheduleHeading = text(body.scheduleHeading, settings.scheduleHeading);
    settings.scheduleIntro = text(body.scheduleIntro, settings.scheduleIntro);

    if (body.hero !== undefined) {
      const hero = section("hero");
      const previousKey = settings.hero.backgroundImageKey?.trim();

      settings.hero.eyebrow = text(hero.eyebrow, settings.hero.eyebrow);
      settings.hero.title = text(hero.title, settings.hero.title);
      settings.hero.subtitle = text(hero.subtitle, settings.hero.subtitle);
      settings.hero.backgroundImageUrl = text(
        hero.backgroundImageUrl,
        settings.hero.backgroundImageUrl,
      );
      settings.hero.backgroundImageKey = text(
        hero.backgroundImageKey,
        settings.hero.backgroundImageKey,
      );
      settings.hero.primaryCta = cta(hero.primaryCta, settings.hero.primaryCta);
      settings.hero.secondaryCta = cta(hero.secondaryCta, settings.hero.secondaryCta);

      // Replaced background — the old object is ours to remove. Empty for the
      // default image that ships with the site repo, which we never touch.
      const nextKey = settings.hero.backgroundImageKey?.trim();
      if (previousKey && previousKey !== nextKey) {
        replacedKeys.push(previousKey);
      }
    }

    if (body.about !== undefined) {
      const about = section("about");
      const previousKey = settings.about.imageKey?.trim();

      settings.about.eyebrow = text(about.eyebrow, settings.about.eyebrow);
      settings.about.heading = text(about.heading, settings.about.heading);
      settings.about.body = lines(about.body, settings.about.body);
      settings.about.imageUrl = text(about.imageUrl, settings.about.imageUrl);
      settings.about.imageKey = text(about.imageKey, settings.about.imageKey);

      // Replaced banner — the old object is ours to remove. Empty for an
      // externally-hosted URL, which we never touch.
      const nextKey = settings.about.imageKey?.trim();
      if (previousKey && previousKey !== nextKey) {
        replacedKeys.push(previousKey);
      }
      if (Array.isArray(about.stats)) {
        settings.about.stats = about.stats
          .map((raw) => {
            const stat = (raw ?? {}) as Record<string, unknown>;
            return {
              value: String(stat.value ?? "").trim(),
              label: String(stat.label ?? "").trim(),
            };
          })
          .filter((stat) => stat.value || stat.label);
      }
    }

    if (body.award !== undefined) {
      const award = section("award");
      const previousKey = settings.award.imageKey?.trim();

      settings.award.eyebrow = text(award.eyebrow, settings.award.eyebrow);
      settings.award.heading = text(award.heading, settings.award.heading);
      settings.award.body = text(award.body, settings.award.body);
      settings.award.imageUrl = text(award.imageUrl, settings.award.imageUrl);
      settings.award.imageKey = text(award.imageKey, settings.award.imageKey);
      settings.award.points = lines(award.points, settings.award.points);

      const nextKey = settings.award.imageKey?.trim();
      if (previousKey && previousKey !== nextKey) {
        replacedKeys.push(previousKey);
      }
    }

    if (body.cta !== undefined) {
      const ctaSection = section("cta");
      settings.cta.eyebrow = text(ctaSection.eyebrow, settings.cta.eyebrow);
      settings.cta.heading = text(ctaSection.heading, settings.cta.heading);
      settings.cta.body = text(ctaSection.body, settings.cta.body);
      settings.cta.primaryCta = cta(ctaSection.primaryCta, settings.cta.primaryCta);
      settings.cta.secondaryCta = cta(ctaSection.secondaryCta, settings.cta.secondaryCta);
    }

    if (Array.isArray(body.venues)) {
      settings.venues = body.venues
        .map((raw) => {
          const venue = (raw ?? {}) as Record<string, unknown>;
          return {
            name: String(venue.name ?? "").trim(),
            suburb: String(venue.suburb ?? "").trim(),
          };
        })
        .filter((venue) => venue.name);
    }

    if (Array.isArray(body.comingSoonMonths)) {
      const months = body.comingSoonMonths.map((raw) => {
        const entry = (raw ?? {}) as Record<string, unknown>;
        return {
          year: Number(entry.year),
          month: Number(entry.month),
          note: String(entry.note ?? "").trim(),
        };
      });

      const invalid = months.find(
        (entry) =>
          !Number.isInteger(entry.year) ||
          !Number.isInteger(entry.month) ||
          entry.month < 1 ||
          entry.month > 12,
      );
      if (invalid) {
        return res.status(400).json({
          success: false,
          message: "Each coming-soon month needs a year and a month between 1 and 12",
        });
      }
      settings.comingSoonMonths = months;
    }

    await settings.save();

    // After the write, never before: a failed cleanup must not roll back an
    // edit the admin asked for. Same rule as updatePartner / updateFestival.
    for (const key of replacedKeys) {
      await deleteUploadedObject(key);
    }

    res.status(200).json({ success: true, message: "Settings saved", data: settings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
