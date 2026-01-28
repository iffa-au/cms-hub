import ContentType from "../models/contentType.model.ts";

export const getContentTypes = async (req, res) => {
  try {
    const items = await ContentType.find().sort({ name: 1 });
    res.status(200).json({
      success: true,
      message: "Content types fetched successfully",
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

export const getContentType = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await ContentType.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Content type not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Content type fetched successfully",
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

export const createContentType = async (req, res) => {
  try {
    const { name, description = "" } = req.body || {};
    if (!name || typeof name !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });
    }
    const existing = await ContentType.findOne({ name });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Content type already exists" });
    }
    const created = await ContentType.create({ name, description });
    res.status(201).json({
      success: true,
      message: "Content type created successfully",
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

export const updateContentType = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body || {};
    const updated = await ContentType.findByIdAndUpdate(
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
        .json({ success: false, message: "Content type not found" });
    }
    res.status(200).json({
      success: true,
      message: "Content type updated successfully",
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

export const deleteContentType = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ContentType.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Content type not found" });
    }
    res.status(200).json({
      success: true,
      message: "Content type deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};





