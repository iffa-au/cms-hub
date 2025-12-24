import Country from "../models/country.model.ts";

export const getCountries = async (req, res) => {
  try {
    const items = await Country.find();
    res.status(200).json({
      success: true,
      message: "Countries fetched successfully",
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

export const getCountry = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Country.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Country not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Country fetched successfully",
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

export const createCountry = async (req, res) => {
  try {
    const { name, description = "" } = req.body || {};
    if (!name || typeof name !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });
    }
    const existing = await Country.findOne({ name });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, message: "Country already exists" });
    }
    const created = await Country.create({ name, description });
    res.status(201).json({
      success: true,
      message: "Country created successfully",
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

export const updateCountry = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body || {};
    const updated = await Country.findByIdAndUpdate(
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
        .json({ success: false, message: "Country not found" });
    }
    res.status(200).json({
      success: true,
      message: "Country updated successfully",
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

export const deleteCountry = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Country.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Country not found" });
    }
    res.status(200).json({
      success: true,
      message: "Country deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

