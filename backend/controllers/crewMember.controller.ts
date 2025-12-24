import CrewMember from "../models/crewMember.model.ts";

export const getCrewMembers = async (req, res) => {
  try {
    const items = await CrewMember.find();
    res.status(200).json({
      success: true,
      message: "Crew members fetched successfully",
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

export const getCrewMember = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await CrewMember.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Crew member not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Crew member fetched successfully",
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

export const createCrewMember = async (req, res) => {
  try {
    const {
      name,
      biography = "",
      profilePicture = "",
      description = "",
    } = req.body || {};
    if (!name || typeof name !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Name is required" });
    }
    const created = await CrewMember.create({
      name,
      biography,
      profilePicture,
      description,
    });
    res.status(201).json({
      success: true,
      message: "Crew member created successfully",
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

export const updateCrewMember = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, biography, profilePicture, description } = req.body || {};
    const updated = await CrewMember.findByIdAndUpdate(
      id,
      {
        $set: {
          ...(name !== undefined ? { name } : {}),
          ...(biography !== undefined ? { biography } : {}),
          ...(profilePicture !== undefined ? { profilePicture } : {}),
          ...(description !== undefined ? { description } : {}),
        },
      },
      { new: true }
    );
    if (!updated) {
      return res
        .status(404)
        .json({ success: false, message: "Crew member not found" });
    }
    res.status(200).json({
      success: true,
      message: "Crew member updated successfully",
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

export const deleteCrewMember = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await CrewMember.findByIdAndDelete(id);
    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Crew member not found" });
    }
    res.status(200).json({
      success: true,
      message: "Crew member deleted successfully",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
