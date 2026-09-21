import CrewRole from "../models/crewRole.model.js";
import CrewAssignment from "../models/crewAssignment.model.js";

export const getCrewRoles = async (req, res) => {
  try {
    const items = await CrewRole.find()
      .collation({ locale: "en", strength: 2 })
      .sort({ name: 1 });
    res.status(200).json({
      success: true,
      message: "Crew roles fetched successfully",
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

export const getCrewRole = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await CrewRole.findById(id);
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Crew role not found" });
    }
    res.status(200).json({
      success: true,
      message: "Crew role fetched successfully",
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

export const createCrewRole = async (req, res) => {
  try {
    const { name, description = "" } = req.body || {};
    if (!name || typeof name !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });
    }
    const existing = await CrewRole.findOne({ name });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Crew role already exists" });
    }
    const created = await CrewRole.create({ name, description });
    res.status(201).json({
      success: true,
      message: "Crew role created successfully",
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

export const updateCrewRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body || {};
    const updated = await CrewRole.findByIdAndUpdate(
      id,
      {
        $set: {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
        },
      },
      { new: true }
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Crew role not found" });
    }
    res.status(200).json({
      success: true,
      message: "Crew role updated successfully",
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

/**
 * Refuses to delete a role any crew assignment still uses.
 *
 * A role label is shared across films — one row here backs hundreds of
 * credits on 2022-2025 submissions. Deleting it used to leave every one of
 * those assignments pointing at an id that resolves to nothing, which is how
 * 616 of the 1,516 assignments in production came to reference a role that no
 * longer exists. The record vanished from the CMS and its references did not,
 * which reads as "the delete didn't reach the database".
 *
 * Blocking rather than cascading is deliberate: cascading would make one
 * click destroy hundreds of historical credits with no undo. Reassign or
 * remove the assignments first, then the role deletes.
 */
export const deleteCrewRole = async (req, res) => {
  try {
    const { id } = req.params;

    const inUse = await CrewAssignment.countDocuments({ crewRoleId: id });
    if (inUse > 0) {
      return res.status(409).json({
        success: false,
        message: `This role is used by ${inUse} crew assignment${inUse === 1 ? "" : "s"} and cannot be deleted. Reassign them first.`,
        inUse,
      });
    }

    const deleted = await CrewRole.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Crew role not found" });
    }
    res.status(200).json({
      success: true,
      message: "Crew role deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
