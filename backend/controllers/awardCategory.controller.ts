import { Types } from "mongoose";
import AwardCategory, { NOMINEE_TYPES } from "../models/awardCategory.model.js";

/**
 * Accepts only the submission-form fields that are present and well formed,
 * so a partial update leaves the rest alone.
 */
function submissionFields(body: any) {
  const out: Record<string, unknown> = {};
  if (typeof body?.openForSubmission === "boolean") {
    out.openForSubmission = body.openForSubmission;
  }
  if (typeof body?.group === "string") out.group = body.group.trim();
  if (NOMINEE_TYPES.includes(body?.nomineeType)) out.nomineeType = body.nomineeType;
  if (Array.isArray(body?.contentTypeIds)) {
    out.contentTypeIds = body.contentTypeIds
      .map((id: unknown) => String(id || ""))
      .filter((id: string) => Types.ObjectId.isValid(id));
  }
  if (Number.isFinite(Number(body?.sortOrder)) && body?.sortOrder !== null && body?.sortOrder !== "") {
    out.sortOrder = Number(body.sortOrder);
  }
  return out;
}

// `?open=true` returns only the categories the public submission form
// offers, in form order. Without it, every category, by name, as before.
export const getAwardCategories = async (req, res) => {
  try {
    const openOnly = req.query?.open === "true";
    const items = openOnly
      ? await AwardCategory.find({ openForSubmission: true }).sort({ sortOrder: 1, name: 1 })
      : await AwardCategory.find().sort({ name: 1 });
    res.status(200).json({
      success: true,
      message: "Award categories fetched successfully",
      data: items,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getAwardCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await AwardCategory.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Award category not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Award category fetched successfully",
      data: item,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createAwardCategory = async (req, res) => {
  try {
    const { name, description = "" } = req.body || {};
    if (!name || typeof name !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });
    }
    const existing = await AwardCategory.findOne({ name });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Award category already exists" });
    }
    const created = await AwardCategory.create({
      name,
      description,
      ...submissionFields(req.body),
    });
    res.status(201).json({
      success: true,
      message: "Award category created successfully",
      data: created,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateAwardCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body || {};
    const updated = await AwardCategory.findByIdAndUpdate(
      id,
      {
        $set: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
          ...submissionFields(req.body),
        },
      },
      { new: true }
    );
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Award category not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Award category updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteAwardCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await AwardCategory.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Award category not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Award category deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};





