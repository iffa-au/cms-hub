import Submission from "../models/submission.model.js";
import type { AuthedRequest } from "../middlewares/auth.middleware.js";
import { Types } from "mongoose";
import SubmissionGenre from "../models/submissionGenre.model.js";
import { sendSubmissionReceipt } from "../libs/mailer.js";

// Delete a submission (admin/staff). Removes related mappings and nominations.
export const deleteSubmission = async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const existing = await Submission.findById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }
    // Best-effort cascading deletes
    try {
      const CrewAssignment = (await import("../models/crewAssignment.model.js"))
        .default;
      const Nomination = (await import("../models/nomination.model.js"))
        .default;
      await Promise.all([
        SubmissionGenre.deleteMany({ submissionId: existing._id }),
        CrewAssignment.deleteMany({ submissionId: existing._id }),
        Nomination.deleteMany({ submissionId: existing._id }),
      ]);
    } catch (e) {
      console.error("Related cleanup failed during submission delete:", e);
      // continue; not fatal
    }
    await Submission.findByIdAndDelete(existing._id);
    return res.status(200).json({
      success: true,
      message: "Submission deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createSubmission = async (req: AuthedRequest, res) => {
  try {
    const {
      title,
      synopsis = "",
      releaseDate,
      potraitImageUrl = "",
      landscapeImageUrl = "",
      imdbUrl = "",
      trailerUrl = "",
      languageId,
      countryId,
      contentTypeId,
      genreIds,
      productionHouse = "",
      distributor = "",
    } = req.body || {};

    const providedGenreIds: string[] = Array.isArray(genreIds)
      ? genreIds.filter(Boolean)
      : [];

    if (!title || !releaseDate || !languageId || !countryId || !contentTypeId) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: title, releaseDate, languageId, countryId, contentTypeId",
      });
    }
    if (providedGenreIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one genre (genreIds[]) is required",
      });
    }
    const creatorId = req.user?.sub;
    if (!creatorId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const uniqueGenreIds = Array.from(new Set(providedGenreIds)) as string[];

    const created = await Submission.create({
      creatorId,
      title,
      synopsis,
      releaseDate: new Date(releaseDate),
      potraitImageUrl,
      landscapeImageUrl,
      imdbUrl,
      trailerUrl,
      languageId,
      countryId,
      contentTypeId,
      genreIds: uniqueGenreIds.map((gId) => new Types.ObjectId(gId)),
      productionHouse: String(productionHouse || "").trim(),
      distributor: String(distributor || "").trim(),
    });

    // Map many-to-many genres for internal CMS submissions as well
    try {
      if (uniqueGenreIds.length > 0) {
        await SubmissionGenre.insertMany(
          uniqueGenreIds.map((gId) => ({
            submissionId: created._id,
            genreId: new Types.ObjectId(gId),
          })),
          { ordered: false },
        );
      }
    } catch (e) {
      console.error("Failed to create SubmissionGenre mappings (internal):", e);
      // non-fatal
    }

    res.status(201).json({
      success: true,
      message: "Submission created successfully",
      data: created,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Public endpoint for external submission forms (no auth required).
// Minimal spam protection recommended at the edge (reCAPTCHA/Arcjet on the site).
export const createSubmissionPublic = async (req, res) => {
  try {
    const {
      title,
      synopsis = "",
      releaseDate,
      potraitImageUrl = "",
      landscapeImageUrl = "",
      imdbUrl = "",
      trailerUrl = "",
      languageId,
      countryId,
      contentTypeId,
      genreIds,
      crew,
      contactEmail,
      productionHouse = "",
      distributor = "",
    } = req.body || {};

    const providedGenreIds: string[] = Array.isArray(genreIds)
      ? genreIds.filter(Boolean)
      : [];

    if (!title || !releaseDate || !languageId || !countryId || !contentTypeId) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: title, releaseDate, languageId, countryId, contentTypeId",
      });
    }
    if (providedGenreIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one genre (genreIds[]) is required",
      });
    }

    // Create anonymous creator id for public submission
    const creatorId = new Types.ObjectId();

    // Normalize crew payload if present
    const normalizeGroup = (arr: any) =>
      Array.isArray(arr)
        ? arr
            .slice(0, 200)
            .map((x) => ({
              fullName: String(x?.fullName || "").trim(),
              role: String(x?.role || "").trim(),
              imageUrl: String(x?.imageUrl || "").trim(),
              biography: String(x?.biography || "").trim(),
              instagramUrl: String(x?.instagramUrl || "").trim(),
              order: Number.isFinite(x?.order) ? Number(x.order) : 0,
            }))
            .filter((x) => x.fullName)
        : [];
    const crewGroups =
      crew && typeof crew === "object"
        ? {
            actors: normalizeGroup((crew as any).actors),
            directors: normalizeGroup((crew as any).directors),
            producers: normalizeGroup((crew as any).producers),
            other: normalizeGroup((crew as any).other),
          }
        : { actors: [], directors: [], producers: [], other: [] };

    const uniqueGenreIds = Array.from(new Set(providedGenreIds)) as string[];

    const created = await Submission.create({
      creatorId,
      title,
      synopsis,
      releaseDate: new Date(releaseDate),
      potraitImageUrl,
      landscapeImageUrl,
      imdbUrl,
      trailerUrl,
      languageId,
      countryId,
      contentTypeId,
      genreIds: uniqueGenreIds.map((gId) => new Types.ObjectId(gId)),
      crew: crewGroups,
      productionHouse: String(productionHouse || "").trim(),
      distributor: String(distributor || "").trim(),
    });
    console.log("sending submission receipt email to", contactEmail);
    // Send submission receipt email (fire-and-forget; do not block response)
    if (contactEmail) {
      const safeEmail = String(contactEmail).trim().toLowerCase();
      const submissionDate = new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format((created as any).createdAt ?? new Date());
      void sendSubmissionReceipt(safeEmail, {
        title,
        id: created._id.toString(),
        submissionDate,
      }).catch((e) => {
        console.error("Mail send failed:", e);
      });
    }

    // Map many-to-many genres (public)
    try {
      if (uniqueGenreIds.length > 0) {
        await SubmissionGenre.insertMany(
          uniqueGenreIds.map((gId) => ({
            submissionId: created._id,
            genreId: new Types.ObjectId(gId),
          })),
          { ordered: false },
        );
      }
    } catch (e) {
      console.error("Failed to create SubmissionGenre mappings (public):", e);
    }
    res.status(201).json({
      success: true,
      message: "Submission created successfully",
      data: created,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateSubmission = async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.sub;
    const role = req.user?.role;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const existing = await Submission.findById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    const isAdmin = role === "admin";
    const isOwner = String(existing.creatorId) === String(userId);
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // Non-admins can only modify while in SUBMITTED state
    if (!isAdmin && existing.status !== "SUBMITTED") {
      return res.status(400).json({
        success: false,
        message: "Cannot modify a reviewed submission",
      });
    }

    const {
      title,
      synopsis,
      releaseDate,
      potraitImageUrl,
      landscapeImageUrl,
      imdbUrl,
      trailerUrl,
      languageId,
      countryId,
      contentTypeId,
      isFeatured,
      genreIds,
      productionHouse,
      distributor,
    } = req.body || {};

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (synopsis !== undefined) updates.synopsis = synopsis;
    if (releaseDate !== undefined) {
      const parsedDate =
        releaseDate instanceof Date
          ? releaseDate
          : new Date(String(releaseDate));
      if (isNaN(parsedDate.getTime())) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid releaseDate" });
      }
      updates.releaseDate = parsedDate;
    }
    if (potraitImageUrl !== undefined)
      updates.potraitImageUrl = potraitImageUrl;
    if (landscapeImageUrl !== undefined)
      updates.landscapeImageUrl = landscapeImageUrl;
    if (imdbUrl !== undefined) updates.imdbUrl = imdbUrl;
    if (trailerUrl !== undefined) updates.trailerUrl = trailerUrl;
    if (languageId !== undefined) updates.languageId = languageId;
    if (countryId !== undefined) updates.countryId = countryId;
    if (contentTypeId !== undefined) updates.contentTypeId = contentTypeId;
    if (isAdmin && isFeatured !== undefined) updates.isFeatured = !!isFeatured;
    if (productionHouse !== undefined)
      updates.productionHouse = String(productionHouse || "").trim();
    if (distributor !== undefined)
      updates.distributor = String(distributor || "").trim();

    // Handle genres update if provided
    const updatingGenres = Array.isArray(genreIds);
    let uniqueGenreIds: string[] | null = null;
    if (updatingGenres) {
      const providedGenreIds: string[] = genreIds.filter(Boolean);
      if (providedGenreIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one genre (genreIds[]) is required",
        });
      }
      uniqueGenreIds = Array.from(new Set(providedGenreIds)) as string[];
      updates.genreIds = uniqueGenreIds.map((gId) => new Types.ObjectId(gId));
    }

    const updated = await Submission.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true },
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }

    // Replace genre mappings if we updated genres
    if (updatingGenres && uniqueGenreIds) {
      try {
        await SubmissionGenre.deleteMany({ submissionId: updated._id });
        if (uniqueGenreIds.length > 0) {
          await SubmissionGenre.insertMany(
            uniqueGenreIds.map((gId) => ({
              submissionId: updated._id,
              genreId: new Types.ObjectId(gId),
            })),
            { ordered: false },
          );
        }
      } catch (e) {
        console.error("Failed to update SubmissionGenre mappings (update):", e);
        // do not fail the whole request; mappings can be retried
      }
    }

    res.status(200).json({
      success: true,
      message: "Submission updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getMySubmissions = async (req: AuthedRequest, res) => {
  try {
    const creatorId = req.user?.sub;
    if (!creatorId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const items = await Submission.find({ creatorId })
      .sort({ createdAt: -1 })
      .populate("genreIds");
    res.status(200).json({
      success: true,
      message: "My submissions fetched successfully",
      data: items,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Submission.findById(id).populate("genreIds");
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }
    res.status(200).json({
      success: true,
      message: "Submission fetched successfully",
      data: item,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getSubmissionOverview = async (req, res) => {
  try {
    const { id } = req.params;
    const expand = String((req.query?.expand as string) || "").toLowerCase();
    const includeCrew = expand.split(",").includes("crew");
    const includeMeta = expand.split(",").includes("meta");
    const oid = new Types.ObjectId(id);
    const rows = await Submission.aggregate([
      { $match: { _id: oid } },
      {
        $lookup: {
          from: "contenttypes",
          localField: "contentTypeId",
          foreignField: "_id",
          as: "contentType",
        },
      },
      {
        $lookup: {
          from: "languages",
          localField: "languageId",
          foreignField: "_id",
          as: "language",
        },
      },
      {
        $lookup: {
          from: "countries",
          localField: "countryId",
          foreignField: "_id",
          as: "country",
        },
      },
      {
        $lookup: {
          from: "submissiongenres",
          localField: "_id",
          foreignField: "submissionId",
          as: "genreLinks",
        },
      },
      {
        $lookup: {
          from: "genres",
          localField: "genreLinks.genreId",
          foreignField: "_id",
          as: "genres",
        },
      },
      {
        $project: {
          creatorId: 1,
          title: 1,
          synopsis: 1,
          releaseDate: 1,
          potraitImageUrl: 1,
          landscapeImageUrl: 1,
          status: 1,
          languageId: 1,
          countryId: 1,
          contentTypeId: 1,
          imdbUrl: 1,
          trailerUrl: 1,
          isFeatured: 1,
          productionHouse: 1,
          distributor: 1,
          crew: 1,
          createdAt: 1,
          updatedAt: 1,
          contentType: {
            _id: { $arrayElemAt: ["$contentType._id", 0] },
            name: { $arrayElemAt: ["$contentType.name", 0] },
          },
          language: {
            _id: { $arrayElemAt: ["$language._id", 0] },
            name: { $arrayElemAt: ["$language.name", 0] },
          },
          country: {
            _id: { $arrayElemAt: ["$country._id", 0] },
            name: { $arrayElemAt: ["$country.name", 0] },
          },
          genres: {
            $map: {
              input: "$genres",
              as: "g",
              in: { _id: "$$g._id", name: "$$g.name" },
            },
          },
        },
      },
    ]);
    const overview = rows[0];
    if (!overview) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }
    // Optionally expand crew assignments
    if (includeCrew) {
      try {
        const CrewAssignment = (
          await import("../models/crewAssignment.model.js")
        ).default;
        const CrewMember = (await import("../models/crewMember.model.js"))
          .default;
        const CrewRole = (await import("../models/crewRole.model.js")).default;
        const assigns = await CrewAssignment.find({ submissionId: oid });
        const memberIds = assigns.map((a) => a.crewMemberId);
        const roleIds = assigns.map((a) => a.crewRoleId);
        const [members, roles] = await Promise.all([
          CrewMember.find({ _id: { $in: memberIds } }),
          CrewRole.find({ _id: { $in: roleIds } }),
        ]);
        const memberMap = new Map(members.map((m) => [String(m._id), m]));
        const roleMap = new Map(roles.map((r) => [String(r._id), r]));
        overview.crew = assigns.map((a) => ({
          _id: a._id,
          crewMemberId: a.crewMemberId,
          crewRoleId: a.crewRoleId,
          member: (() => {
            const m = memberMap.get(String(a.crewMemberId));
            return m ? { _id: m._id, name: m.name } : null;
          })(),
          role: (() => {
            const r = roleMap.get(String(a.crewRoleId));
            return r ? { _id: r._id, name: r.name } : null;
          })(),
        }));
      } catch (e) {
        // ignore crew expansion errors
      }
    }
    // Optionally include metadata lists for dropdowns in editors
    if (includeMeta) {
      try {
        const Genre = (await import("../models/genre.model.js")).default;
        const Country = (await import("../models/country.model.js")).default;
        const Language = (await import("../models/language.model.js")).default;
        const ContentType = (await import("../models/contentType.model.js"))
          .default;
        const [genres, countries, languages, contentTypes] = await Promise.all([
          Genre.find({}, { _id: 1, name: 1 })
            .collation({ locale: "en", strength: 2 })
            .sort({ name: 1 }),
          Country.find({}, { _id: 1, name: 1 })
            .collation({ locale: "en", strength: 2 })
            .sort({ name: 1 }),
          Language.find({}, { _id: 1, name: 1 })
            .collation({ locale: "en", strength: 2 })
            .sort({ name: 1 }),
          ContentType.find({}, { _id: 1, name: 1 })
            .collation({ locale: "en", strength: 2 })
            .sort({ name: 1 }),
        ]);
        overview.meta = {
          genres,
          countries,
          languages,
          contentTypes,
        };
      } catch (e) {
        // ignore meta expansion errors
      }
    }
    console.log("overview", overview);
    return res.status(200).json({
      success: true,
      message: "Submission overview fetched successfully",
      data: overview,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const adminListSubmissions = async (req, res) => {
  try {
    const {
      status,
      languageId,
      countryId,
      contentTypeId,
      featured,
      page = "1",
      limit = "20",
    } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (languageId) filter.languageId = languageId;
    if (countryId) filter.countryId = countryId;
    if (contentTypeId) filter.contentTypeId = contentTypeId;
    if (featured !== undefined) filter.isFeatured = featured === "true";

    const pageNum = Math.max(parseInt(page || "1", 10) || 1, 1);
    const limitNum = Math.min(
      Math.max(parseInt(limit || "20", 10) || 20, 1),
      100,
    );
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Submission.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limitNum },
        // Join genres via mapping table
        {
          $lookup: {
            from: "submissiongenres",
            localField: "_id",
            foreignField: "submissionId",
            as: "genreLinks",
          },
        },
        {
          $lookup: {
            from: "genres",
            localField: "genreLinks.genreId",
            foreignField: "_id",
            as: "genres",
          },
        },
        // Join content type
        {
          $lookup: {
            from: "contenttypes",
            localField: "contentTypeId",
            foreignField: "_id",
            as: "contentType",
          },
        },
        {
          $project: {
            creatorId: 1,
            title: 1,
            synopsis: 1,
            releaseDate: 1,
            potraitImageUrl: 1,
            landscapeImageUrl: 1,
            status: 1,
            languageId: 1,
            countryId: 1,
            contentTypeId: 1,
            imdbUrl: 1,
            trailerUrl: 1,
            isFeatured: 1,
            productionHouse: 1,
            distributor: 1,
            createdAt: 1,
            updatedAt: 1,
            contentTypeName: {
              $ifNull: [{ $arrayElemAt: ["$contentType.name", 0] }, null],
            },
            genreNames: {
              $map: { input: "$genres", as: "g", in: "$$g.name" },
            },
          },
        },
      ]),
      Submission.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: "Submissions fetched successfully",
      data: items,
      meta: { page: pageNum, limit: limitNum, total },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const approveSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Submission.findByIdAndUpdate(
      id,
      { $set: { status: "APPROVED" } },
      { new: true },
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }
    res.status(200).json({
      success: true,
      message: "Submission approved",
      data: updated,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const rejectSubmission = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Submission.findByIdAndUpdate(
      id,
      { $set: { status: "REJECTED" } },
      { new: true },
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }
    res.status(200).json({
      success: true,
      message: "Submission rejected",
      data: updated,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
