import Language from "../models/language.model.js";

export const getLanguages = async (req, res) => {
  try {
    const languages = await Language.find().sort({ name: 1 });
    res.status(200).json({
      success: true,
      message: "Languages fetched successfully",
      data: languages,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getLanguage = async (req, res) => {
  try {
    const { id } = req.params;
    const language = await Language.findById(id);
    if (!language) {
      return res.status(404).json({
        success: false,
        message: "Language not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Language fetched successfully",
      data: language,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createLanguage = async (req, res) => {
  try {
    const { name, description = "" } = req.body || {};
    if (!name || typeof name !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });
    }
    const existing = await Language.findOne({ name });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Language already exists" });
    }
    const created = await Language.create({ name, description });
    res.status(201).json({
      success: true,
      message: "Language created successfully",
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

export const updateLanguage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body || {};
    const updated = await Language.findByIdAndUpdate(
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
        .json({ success: false, message: "Language not found" });
    }
    res.status(200).json({
      success: true,
      message: "Language updated successfully",
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

export const deleteLanguage = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Language.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Language not found" });
    }
    res.status(200).json({
      success: true,
      message: "Language deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
