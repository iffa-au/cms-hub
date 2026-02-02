import type { AuthedRequest } from "../middlewares/auth.middleware.js";
import CrewAssignment from "../models/crewAssignment.model.js";
import Submission from "../models/submission.model.js";

export const getCrewAssignments = async (req, res) => {
  try {
    const {
      submissionId,
      crewMemberId,
      crewRoleId,
      page = "1",
      limit = "50",
    } = req.query as Record<string, string>;

    const filter: Record<string, unknown> = {};
    if (submissionId) filter.submissionId = submissionId;
    if (crewMemberId) filter.crewMemberId = crewMemberId;
    if (crewRoleId) filter.crewRoleId = crewRoleId;

    const pageNum = Math.max(parseInt(page || "1", 10) || 1, 1);
    const limitNum = Math.min(
      Math.max(parseInt(limit || "50", 10) || 50, 1),
      200
    );
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      CrewAssignment.find(filter).skip(skip).limit(limitNum),
      CrewAssignment.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      message: "Crew assignments fetched successfully",
      data: items,
      meta: { page: pageNum, limit: limitNum, total },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getCrewAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await CrewAssignment.findById(id);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Crew assignment not found" });
    }
    res.status(200).json({
      success: true,
      message: "Crew assignment fetched successfully",
      data: item,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const createCrewAssignment = async (req: AuthedRequest, res) => {
  try {
    const { submissionId, crewMemberId, crewRoleId } = req.body || {};
    if (!submissionId || !crewMemberId || !crewRoleId) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: submissionId, crewMemberId, crewRoleId",
      });
    }
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }
    const isAdmin = req.user?.role === "admin";
    const isOwner = String(submission.creatorId) === String(userId);
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // Prevent duplicates (unique index also enforces this)
    const exists = await CrewAssignment.findOne({
      submissionId,
      crewMemberId,
      crewRoleId,
    });
    if (exists) {
      return res.status(409).json({
        success: false,
        message: "Crew assignment already exists",
      });
    }

    const created = await CrewAssignment.create({
      submissionId,
      crewMemberId,
      crewRoleId,
    });
    res.status(201).json({
      success: true,
      message: "Crew assignment created successfully",
      data: created,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateCrewAssignment = async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const existing = await CrewAssignment.findById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Crew assignment not found" });
    }
    const submission = await Submission.findById(existing.submissionId);
    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }
    const isAdmin = req.user?.role === "admin";
    const isOwner = String(submission.creatorId) === String(userId);
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const { crewMemberId, crewRoleId } = req.body || {};
    const updates: Record<string, unknown> = {};
    if (crewMemberId !== undefined) updates.crewMemberId = crewMemberId;
    if (crewRoleId !== undefined) updates.crewRoleId = crewRoleId;
    // Do not allow changing submissionId via update to keep permission simple

    // If both crewMemberId and crewRoleId set, guard uniqueness
    const targetMemberId =
      (updates.crewMemberId as string) || String(existing.crewMemberId);
    const targetRoleId =
      (updates.crewRoleId as string) || String(existing.crewRoleId);
    const dup = await CrewAssignment.findOne({
      _id: { $ne: id },
      submissionId: existing.submissionId,
      crewMemberId: targetMemberId,
      crewRoleId: targetRoleId,
    });
    if (dup) {
      return res.status(409).json({
        success: false,
        message: "Crew assignment already exists",
      });
    }

    const updated = await CrewAssignment.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );
    res.status(200).json({
      success: true,
      message: "Crew assignment updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const deleteCrewAssignment = async (req: AuthedRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const existing = await CrewAssignment.findById(id);
    if (!existing) {
      return res
        .status(404)
        .json({ success: false, message: "Crew assignment not found" });
    }
    const submission = await Submission.findById(existing.submissionId);
    if (!submission) {
      return res
        .status(404)
        .json({ success: false, message: "Submission not found" });
    }
    const isAdmin = req.user?.role === "admin";
    const isOwner = String(submission.creatorId) === String(userId);
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    await CrewAssignment.findByIdAndDelete(id);
    res
      .status(200)
      .json({ success: true, message: "Crew assignment deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
