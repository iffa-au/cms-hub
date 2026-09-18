import { Request, Response } from "express";
import { Types } from "mongoose";
import FeaturedFilms, {
  MAX_FEATURED_FILMS,
  type IFeaturedFilmEntry,
} from "../models/featuredFilms.model.js";
import Submission from "../models/submission.model.js";

/**
 * The homepage "Featured Selection" row — see featuredFilms.model.ts.
 *
 * Read paths never create the singleton: no document simply means nothing has
 * been curated yet, and the public route says so with `configured: false` so
 * the site can tell "never set up" apart from "deliberately emptied".
 */

const readEntries = async (): Promise<IFeaturedFilmEntry[] | null> => {
  const doc = await FeaturedFilms.findOne().lean();
  return doc ? doc.entries : null;
};

/* ------------------------------- public ------------------------------- */

/**
 * Public API: the curated films in slot order, each merged with its slot's
 * editorial fields.
 *
 * Approved-only, like every public submission route: a film that is later
 * rejected or deleted drops out of the row on its own rather than rendering a
 * hole. Its slot stays in the stored list, so restoring the film restores it.
 */
export const fetchFeaturedFilms = async (_req: Request, res: Response) => {
  try {
    const entries = await readEntries();
    if (!entries || entries.length === 0) {
      return res.status(200).json({ success: true, configured: entries !== null, data: [] });
    }

    const films = await Submission.aggregate([
      {
        $match: {
          _id: { $in: entries.map((entry) => entry.submissionId) },
          status: "APPROVED",
        },
      },
      { $lookup: { from: "genres", localField: "genreIds", foreignField: "_id", as: "genreDocs" } },
      { $lookup: { from: "countries", localField: "countryId", foreignField: "_id", as: "countryDocs" } },
      // Legacy director source, for the older films that were never given
      // embedded crew. Same fallback fetchSubmission uses.
      {
        $lookup: {
          from: "crewassignments",
          localField: "_id",
          foreignField: "submissionId",
          as: "crewAssignments",
        },
      },
      {
        $lookup: {
          from: "crewmembers",
          localField: "crewAssignments.crewMemberId",
          foreignField: "_id",
          as: "crewMembers",
        },
      },
      {
        $project: {
          title: 1,
          synopsis: 1,
          trailerUrl: 1,
          durationHours: 1,
          durationMinutes: 1,
          portraitImageUrl: "$potraitImageUrl",
          landscapeImageUrl: "$landscapeImageUrl",
          submissionYear: "$submission_year",
          genres: { $map: { input: "$genreDocs", as: "g", in: "$$g.name" } },
          country: { $ifNull: [{ $first: "$countryDocs.name" }, ""] },
          crewDirectors: {
            $map: { input: { $ifNull: ["$crew.directors", []] }, as: "d", in: "$$d.fullName" },
          },
          directors: { $map: { input: "$crewMembers", as: "cm", in: "$$cm.name" } },
        },
      },
    ]);

    const byId = new Map(films.map((film) => [String(film._id), film]));
    const data = entries.flatMap((entry) => {
      const film = byId.get(String(entry.submissionId));
      if (!film) return [];
      const { _id, ...rest } = film;
      return [
        {
          id: String(_id),
          ...rest,
          badge: entry.badge,
          titleAccent: entry.titleAccent,
          genre: entry.genre,
        },
      ];
    });

    res.status(200).json({ success: true, configured: true, data });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/* -------------------------------- staff ------------------------------- */

/**
 * Staff-only: the stored slots with enough of each film to draw the CMS list.
 *
 * Not filtered by status, so a slot whose film has since been rejected still
 * shows up in the CMS (flagged by `status`) instead of silently vanishing.
 * `missing` marks a slot whose submission was deleted outright.
 */
export const getFeaturedFilmsForManage = async (_req: Request, res: Response) => {
  try {
    const entries = (await readEntries()) ?? [];
    const films = await Submission.find(
      { _id: { $in: entries.map((entry) => entry.submissionId) } },
      { title: 1, potraitImageUrl: 1, landscapeImageUrl: 1, submission_year: 1, status: 1 },
    ).lean();
    const byId = new Map(films.map((film) => [String(film._id), film]));

    const data = entries.map((entry) => {
      const film = byId.get(String(entry.submissionId));
      return {
        submissionId: String(entry.submissionId),
        badge: entry.badge,
        titleAccent: entry.titleAccent,
        genre: entry.genre,
        film: film
          ? {
              _id: String(film._id),
              title: film.title,
              potraitImageUrl: film.potraitImageUrl,
              landscapeImageUrl: film.landscapeImageUrl,
              submission_year: film.submission_year,
              status: film.status,
            }
          : null,
      };
    });

    res.status(200).json({ success: true, data, max: MAX_FEATURED_FILMS });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

/**
 * Staff-only: replace the whole row in one write. Takes an ordered array of
 * `{ submissionId, badge?, titleAccent?, genre? }`; order in the array is
 * order on the homepage.
 *
 * New picks must be approved films. A slot already stored for a film that has
 * since been rejected is allowed through unchanged, so staff can save an
 * unrelated reorder without first being forced to remove it.
 */
export const setFeaturedFilms = async (req: Request, res: Response) => {
  try {
    const raw = (req.body as { entries?: unknown })?.entries;
    if (!Array.isArray(raw) || raw.length > MAX_FEATURED_FILMS) {
      return res.status(400).json({
        success: false,
        message: `entries must be an array of at most ${MAX_FEATURED_FILMS} films`,
      });
    }

    const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

    const entries = raw.map((item) => {
      const value = (item ?? {}) as Record<string, unknown>;
      return {
        submissionId: String(value.submissionId ?? "").trim(),
        badge: text(value.badge, 40),
        titleAccent: text(value.titleAccent, 200),
        genre: text(value.genre, 60),
      };
    });

    if (entries.some((entry) => !Types.ObjectId.isValid(entry.submissionId))) {
      return res.status(400).json({ success: false, message: "Invalid submission id in list" });
    }
    const ids = entries.map((entry) => entry.submissionId);
    if (new Set(ids).size !== ids.length) {
      return res.status(400).json({ success: false, message: "A film can only be featured once" });
    }

    const [films, previous] = await Promise.all([
      Submission.find({ _id: { $in: ids } }, { status: 1, title: 1 }).lean(),
      readEntries(),
    ]);
    const statusById = new Map(films.map((film) => [String(film._id), film.status]));
    const previouslyStored = new Set((previous ?? []).map((entry) => String(entry.submissionId)));

    const missing = ids.filter((id) => !statusById.has(id));
    if (missing.length > 0) {
      return res.status(400).json({ success: false, message: "One or more films no longer exist" });
    }
    const unapproved = films.filter(
      (film) => film.status !== "APPROVED" && !previouslyStored.has(String(film._id)),
    );
    if (unapproved.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Only approved films can be featured: ${unapproved.map((f) => f.title).join(", ")}`,
      });
    }

    const doc = (await FeaturedFilms.findOne()) ?? new FeaturedFilms();
    doc.set(
      "entries",
      entries.map((entry) => ({ ...entry, submissionId: new Types.ObjectId(entry.submissionId) })),
    );
    await doc.save();

    res.status(200).json({ success: true, message: "Featured films updated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
