import AwardCategory from "../models/awardCategory.model.ts";

export const getAwardCategories = async (req, res) => {
  try {
    const items = await AwardCategory.find();
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
    const created = await AwardCategory.create({ name, description });
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





