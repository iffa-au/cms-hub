import Genre from "../models/genre.model.ts";

export const getGenres = async (req, res) => {
  try {
    const items = await Genre.find().sort({ name: 1 });
    res.status(200).json({
      success: true,
      message: "Genres fetched successfully",
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

export const getGenre = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Genre.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Genre not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Genre fetched successfully",
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

export const createGenre = async (req, res) => {
  try {
    const { name, description = "" } = req.body || {};
    if (!name || typeof name !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });
    }
    const existing = await Genre.findOne({ name });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Genre already exists" });
    }
    const created = await Genre.create({ name, description });
    res.status(201).json({
      success: true,
      message: "Genre created successfully",
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

export const updateGenre = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body || {};
    const updated = await Genre.findByIdAndUpdate(
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
        .json({ success: false, message: "Genre not found" });
    }
    res.status(200).json({
      success: true,
      message: "Genre updated successfully",
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

export const deleteGenre = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Genre.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Genre not found" });
    }
    res.status(200).json({
      success: true,
      message: "Genre deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};




