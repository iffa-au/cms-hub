import Submission from "../models/submission.model.ts";
import type { AuthedRequest } from "../middlewares/auth.middleware.ts";
import { Types } from "mongoose";

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
      genreId,
    } = req.body || {};

    if (
      !title ||
      !releaseDate ||
      !languageId ||
      !countryId ||
      !contentTypeId ||
      !genreId
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: title, releaseDate, languageId, countryId, contentTypeId, genreId",
      });
    }
    const creatorId = req.user?.sub;
    if (!creatorId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
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
      genreId,
    });

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
      languageId,
      countryId,
      contentTypeId,
      isFeatured,
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

    const updated = await Submission.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

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
        const CrewAssignment =
          (await import("../models/crewAssignment.model.ts")).default;
        const CrewMember =
          (await import("../models/crewMember.model.ts")).default;
        const CrewRole = (await import("../models/crewRole.model.ts")).default;
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
        const Genre = (await import("../models/genre.model.ts")).default;
        const Country = (await import("../models/country.model.ts")).default;
        const Language = (await import("../models/language.model.ts")).default;
        const ContentType =
          (await import("../models/contentType.model.ts")).default;
        const [genres, countries, languages, contentTypes] = await Promise.all([
          Genre.find({}, { _id: 1, name: 1 }).collation({ locale: "en", strength: 2 }).sort({ name: 1 }),
          Country.find({}, { _id: 1, name: 1 }).collation({ locale: "en", strength: 2 }).sort({ name: 1 }),
          Language.find({}, { _id: 1, name: 1 }).collation({ locale: "en", strength: 2 }).sort({ name: 1 }),
          ContentType.find({}, { _id: 1, name: 1 }).collation({ locale: "en", strength: 2 }).sort({ name: 1 }),
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
      100
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
            createdAt: 1,
            updatedAt: 1,
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
