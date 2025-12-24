import CrewRole from "../models/crewRole.model.ts";

export const getCrewRoles = async (req, res) => {
  try {
    const items = await CrewRole.find();
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

export const deleteCrewRole = async (req, res) => {
  try {
    const { id } = req.params;
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
