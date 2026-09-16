import { Request, Response } from "express";
import CreditRole from "../models/creditRole.model.js";

/**
 * CRUD for the "Other Crew" credited-role vocabulary. Follows the same shape
 * as the other lookup controllers (genre, contentType, ...) so the Metadata
 * page can drive it with the panel pattern it already repeats five times.
 *
 * Two deliberate differences from those:
 *
 * - Duplicate checks are case-insensitive. The unique index on `name` is not:
 *   "editor" and "Editor" are two documents to Mongo, and a dropdown offering
 *   both is how a vocabulary starts drifting. The legacy crewroles collection
 *   is what that looks like after a few years.
 * - E11000 is caught and answered 409 rather than 500. The pre-check above it
 *   loses to a concurrent insert, and "already exists" is the truthful answer
 *   either way.
 */

// Matches the sort collation below: strength 2 compares base letters only, so
// case (and accent) differences collapse.
const CASE_INSENSITIVE = { locale: "en", strength: 2 } as const;

const isDuplicateKeyError = (error: unknown): boolean =>
  (error as { code?: number } | null)?.code === 11000;

export const getCreditRoles = async (req: Request, res: Response) => {
  try {
    const items = await CreditRole.find()
      .collation(CASE_INSENSITIVE)
      .sort({ name: 1 });
    res.status(200).json({
      success: true,
      message: "Credit roles fetched successfully",
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

export const getCreditRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await CreditRole.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Credit role not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Credit role fetched successfully",
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

export const createCreditRole = async (req: Request, res: Response) => {
  try {
    const { name, description = "" } = req.body || {};
    const trimmedName = String(name || "").trim();
    if (!trimmedName) {
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });
    }

    const existing = await CreditRole.findOne({ name: trimmedName })
      .collation(CASE_INSENSITIVE)
      .lean();
    if (existing) {
      return res.status(409).json({
        success: false,
        message: `"${existing.name}" is already on the list`,
      });
    }

    const created = await CreditRole.create({
      name: trimmedName,
      description: String(description || "").trim(),
    });
    res.status(201).json({
      success: true,
      message: "Credit role created successfully",
      data: created,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res
        .status(409)
        .json({ success: false, message: "That credit role already exists" });
    }
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateCreditRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body || {};

    const updates: Record<string, unknown> = {};

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        return res
          .status(400)
          .json({ success: false, message: "Name cannot be empty" });
      }
      // Scoped to other documents, so saving a role without renaming it (or
      // only changing its capitalisation) is not reported as a clash with
      // itself.
      const clash = await CreditRole.findOne({
        _id: { $ne: id },
        name: trimmedName,
      })
        .collation(CASE_INSENSITIVE)
        .lean();
      if (clash) {
        return res.status(409).json({
          success: false,
          message: `"${clash.name}" is already on the list`,
        });
      }
      updates.name = trimmedName;
    }

    if (description !== undefined) {
      updates.description = String(description || "").trim();
    }

    const updated = await CreditRole.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true },
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Credit role not found" });
    }
    res.status(200).json({
      success: true,
      message: "Credit role updated successfully",
      data: updated,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res
        .status(409)
        .json({ success: false, message: "That credit role already exists" });
    }
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Removing a role from the list does NOT rewrite the submissions already
 * credited with it — crew roles are stored as plain strings on the submission
 * document, not as references. Those credits keep the text they were saved
 * with, and the crew editor shows an off-list value as a selected option so it
 * survives the next save rather than being silently blanked.
 */
export const deleteCreditRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await CreditRole.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Credit role not found" });
    }
    res.status(200).json({
      success: true,
      message: "Credit role deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
