import Submission from "../models/submission.model.ts";
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
    } = req.body || {};

    if (!title || !releaseDate || !languageId || !countryId || !contentTypeId) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: title, releaseDate, languageId, countryId, contentTypeId",
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
      Submission.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
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
