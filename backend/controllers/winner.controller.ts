import { Request, Response } from "express";
import Nomination from "../models/nomination.model.js";
import { Types } from "mongoose";

/**
 * Admin/Staff API: lists award winners (nominations flagged `isWinner`) with
 * full display metadata and pagination.
 *
 * This exists separately from `GET /nominations` on purpose. That route hands
 * off to the PUBLIC nomination feed the moment a `year` query is present (see
 * routes/nomination.ts), which returns a different shape and ignores
 * `isWinner`. A year-scoped winners list therefore cannot be built on it — so
 * the CMS Winners page uses this dedicated, always-`isWinner` endpoint.
 *
 * Filters: optional `year`, optional `contentTypeId`. Sorted newest edition
 * first. Used by the CMS Winners page (client/src/app/winners).
 */
export const getWinners = async (req: Request, res: Response) => {
  try {
    const {
      year,
      contentTypeId,
      page = "1",
      limit = "100",
    } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = { isWinner: true };
    if (year) filter.year = Number(year);

    const pageNum = Math.max(parseInt(page || "1", 10) || 1, 1);
    const limitNum = Math.min(
      Math.max(parseInt(limit || "100", 10) || 100, 1),
      100
    );
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Nomination.aggregate([
        { $match: filter },
        { $sort: { year: -1, _id: -1 } },
        { $skip: skip },
        { $limit: limitNum },
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
      message: "Winners fetched successfully",
      data: items,
      meta: { page: pageNum, limit: limitNum, total },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
