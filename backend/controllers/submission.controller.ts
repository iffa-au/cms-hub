import Submission from "../models/submission.model.ts";
import SubmissionGenre from "../models/submissionGenre.model.ts";
import { Types } from "mongoose";
import type { AuthedRequest } from "../middlewares/auth.middleware.ts";

export const createSubmission = async (req: AuthedRequest, res) => {
  try {
    const {
      title,
      synopsis = "",
      releaseDate,
      potraitImageUrl = "",
      landscapeImageUrl = "",
      languageId,
      countryId,
      contentTypeId,
      genreId, // legacy single-genre field (kept for backward compatibility)
      genreIds, // preferred: array of genre ids
    } = req.body || {};

    const providedGenreIds: string[] = Array.isArray(genreIds)
      ? genreIds.filter(Boolean)
      : [];
    const primaryGenreId: string | undefined =
      genreId || providedGenreIds[0] || undefined;

    if (!title || !releaseDate || !languageId || !countryId || !contentTypeId) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: title, releaseDate, languageId, countryId, contentTypeId",
      });
    }

    if (!primaryGenreId) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required field: at least one genre id (genreId or genreIds[])",
      });
    }
    // For integration testing without auth middleware:
    // use authenticated user id if present, otherwise accept creatorId from body,
    // otherwise generate a temporary ObjectId
    let creatorId = req.user?.sub as string | undefined;
    if (!creatorId) {
      const bodyCreator = (req.body as any)?.creatorId as string | undefined;
      creatorId = bodyCreator ?? new Types.ObjectId().toString();
    }

    const created = await Submission.create({
      creatorId,
      title,
      synopsis,
      releaseDate: new Date(releaseDate),
      potraitImageUrl,
      landscapeImageUrl,
      languageId,
      countryId,
      contentTypeId,
      genreId: primaryGenreId,
    });

    // Maintain many-to-many mapping via SubmissionGenre
    try {
      const uniqueGenreIds = Array.from(
        new Set([primaryGenreId, ...providedGenreIds].filter(Boolean))
      ) as string[];
      if (uniqueGenreIds.length > 0) {
        await SubmissionGenre.insertMany(
          uniqueGenreIds.map((gId) => ({
            submissionId: created._id,
            genreId: new Types.ObjectId(gId),
          })),
          { ordered: false }
        );
      }
    } catch (mapErr) {
      // Do not fail the whole request if mapping insert fails
      // eslint-disable-next-line no-console
      console.error("Failed to create SubmissionGenre mappings:", mapErr);
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
    const submissionIdStr = String(id);
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
      languageId,
      countryId,
      contentTypeId,
      isFeatured,
      genreId, // optional single primary genre
      genreIds, // optional full set for many-to-many
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
    if (languageId !== undefined) updates.languageId = languageId;
    if (countryId !== undefined) updates.countryId = countryId;
    if (contentTypeId !== undefined) updates.contentTypeId = contentTypeId;
    if (isAdmin && isFeatured !== undefined) updates.isFeatured = !!isFeatured;
    if (genreId !== undefined) updates.genreId = genreId;

    // If caller provided an explicit list of genreIds (array), replace mappings
    if (Array.isArray(genreIds)) {
      const cleaned = genreIds.filter(Boolean);
      // Keep the document's primary genre aligned to the first provided id if not given explicitly
      if (cleaned.length > 0 && genreId === undefined) {
        updates.genreId = cleaned[0];
      }
      // Replace mapping set transactionally (best-effort without DB transaction)
      await SubmissionGenre.deleteMany({ submissionId: submissionIdStr });
      if (cleaned.length > 0) {
        const unique = Array.from(new Set(cleaned));
        await SubmissionGenre.insertMany(
          unique.map((gId) => ({
            submissionId: new Types.ObjectId(submissionIdStr),
            genreId: new Types.ObjectId(gId),
          })),
          { ordered: false }
        );
      }
    }

    const updated = await Submission.findByIdAndUpdate(submissionIdStr, { $set: updates }, { new: true });

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
    const items = await Submission.find({ creatorId }).sort({ createdAt: -1 });
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
    const item = await Submission.findById(id);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }
    // Enrich with many-to-many genres for editor use
    let genreIds: string[] = [];
    try {
      const links = await SubmissionGenre.find({ submissionId: id }).select("genreId");
      genreIds = links.map((l) => String(l.genreId));
    } catch {
      // ignore enrichment failure
    }
    res.status(200).json({
      success: true,
      message: "Submission fetched successfully",
      data: {
        ...item.toObject(),
        genreIds,
      },
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
      q,
      page = "1",
      limit = "20",
    } = req.query as Record<string, string>;
    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    if (languageId) filter.languageId = languageId;
    if (countryId) filter.countryId = countryId;
    if (contentTypeId) filter.contentTypeId = contentTypeId;
    if (featured !== undefined) filter.isFeatured = featured === "true";
    if (q && typeof q === "string" && q.trim().length > 0) {
      const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.title = { $regex: new RegExp(escapeRegex(q.trim()), "i") };
    }

    const pageNum = Math.max(parseInt(page || "1", 10) || 1, 1);
    const limitNum = Math.min(
      Math.max(parseInt(limit || "20", 10) || 20, 1),
      100
    );
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Submission.aggregate([
        { $match: filter },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limitNum },
        // Lookup many-to-many genres
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
        // Lookup content type
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
            createdAt: 1,
            updatedAt: 1,
            // enrichments
            contentTypeName: { $ifNull: [{ $arrayElemAt: ["$contentType.name", 0] }, null] },
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
      { new: true }
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
      { new: true }
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
