import Nomination from "../models/nomination.model.js";
import Submission from "../models/submission.model.js";
import { Types } from "mongoose";

export const getNominations = async (req, res) => {
  try {
    const {
      submissionId,
      awardCategoryId,
      year,
      isWinner,
      contentTypeId,
      page = "1",
      limit = "20",
    } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (submissionId) filter.submissionId = new Types.ObjectId(submissionId);
    if (awardCategoryId) filter.awardCategoryId = new Types.ObjectId(awardCategoryId);
    if (year) filter.year = Number(year);
    if (isWinner !== undefined) {
      const val = String(isWinner).toLowerCase();
      if (val === "true" || val === "false") {
        filter.isWinner = val === "true";
      }
    }

    const pageNum = Math.max(parseInt(page || "1", 10) || 1, 1);
    const limitNum = Math.min(
      Math.max(parseInt(limit || "20", 10) || 20, 1),
      100
    );
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Nomination.aggregate([
        { $match: filter },
        { $sort: { year: -1, _id: -1 } },
        { $skip: skip },
        { $limit: limitNum },
        // Join submission for title/synopsis and contentTypeId filter
        {
          $lookup: {
            from: "submissions",
            localField: "submissionId",
            foreignField: "_id",
            as: "submission",
          },
        },
        ...(contentTypeId
          ? [
              {
                $match: {
                  "submission.contentTypeId": new Types.ObjectId(contentTypeId),
                },
              },
            ]
          : []),
        {
          $lookup: {
            from: "awardcategories",
            localField: "awardCategoryId",
            foreignField: "_id",
            as: "awardCategory",
          },
        },
        {
          $lookup: {
            from: "crewmembers",
            localField: "crewMemberId",
            foreignField: "_id",
            as: "crewMember",
          },
        },
        {
          $project: {
            submissionId: 1,
            awardCategoryId: 1,
            year: 1,
            isWinner: 1,
            crewMemberId: 1,
            submissionTitle: { $ifNull: [{ $arrayElemAt: ["$submission.title", 0] }, null] },
            submissionSynopsis: { $ifNull: [{ $arrayElemAt: ["$submission.synopsis", 0] }, null] },
            awardCategoryName: { $ifNull: [{ $arrayElemAt: ["$awardCategory.name", 0] }, null] },
            crewMemberName: { $ifNull: [{ $arrayElemAt: ["$crewMember.name", 0] }, null] },
          },
        },
      ]),
      Nomination.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: "Nominations fetched successfully",
      data: items,
      meta: { page: pageNum, limit: limitNum, total },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getNomination = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Nomination.findById(id);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Nomination not found" });
    }
    res.status(200).json({
      success: true,
      message: "Nomination fetched successfully",
      data: item,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createNomination = async (req, res) => {
  try {
    const {
      submissionId,
      awardCategoryId,
      year,
      isWinner = false,
      crewMemberId = null,
    } = req.body || {};
    if (!submissionId || !awardCategoryId || !year) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: submissionId, awardCategoryId, year (number)",
      });
    }
    const submissionExists = await Submission.findById(submissionId);
    if (!submissionExists) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }
    const created = await Nomination.create({
      submissionId,
      awardCategoryId,
      year,
      isWinner,
      crewMemberId: crewMemberId || null,
    });
    res.status(201).json({
      success: true,
      message: "Nomination created successfully",
      data: created,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateNomination = async (req, res) => {
  try {
    const { id } = req.params;
    const { submissionId, awardCategoryId, year, isWinner, crewMemberId } = req.body || {};
    const updated = await Nomination.findByIdAndUpdate(
      id,
      {
        $set: {
          ...(submissionId !== undefined ? { submissionId } : {}),
          ...(awardCategoryId !== undefined ? { awardCategoryId } : {}),
          ...(year !== undefined ? { year } : {}),
          ...(isWinner !== undefined ? { isWinner } : {}),
          ...(crewMemberId !== undefined ? { crewMemberId: crewMemberId || null } : {}),
        },
      },
      { new: true }
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Nomination not found" });
    }
    res.status(200).json({
      success: true,
      message: "Nomination updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const deleteNomination = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Nomination.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Nomination not found" });
    }
    res.status(200).json({
      success: true,
      message: "Nomination deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
