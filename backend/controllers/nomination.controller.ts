import Nomination from "../models/nomination.model.ts";
import Submission from "../models/submission.model.ts";

export const getNominations = async (req, res) => {
  try {
    const {
      submissionId,
      awardCategoryId,
      year,
      page = "1",
      limit = "20",
    } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (submissionId) filter.submissionId = submissionId;
    if (awardCategoryId) filter.awardCategoryId = awardCategoryId;
    if (year) filter.year = Number(year);

    const pageNum = Math.max(parseInt(page || "1", 10) || 1, 1);
    const limitNum = Math.min(
      Math.max(parseInt(limit || "20", 10) || 20, 1),
      100
    );
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      Nomination.find(filter).sort({ year: -1 }).skip(skip).limit(limitNum),
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
    const { submissionId, awardCategoryId, year, isWinner } = req.body || {};
    const updated = await Nomination.findByIdAndUpdate(
      id,
      {
        $set: {
          ...(submissionId !== undefined ? { submissionId } : {}),
          ...(awardCategoryId !== undefined ? { awardCategoryId } : {}),
          ...(year !== undefined ? { year } : {}),
          ...(isWinner !== undefined ? { isWinner } : {}),
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
