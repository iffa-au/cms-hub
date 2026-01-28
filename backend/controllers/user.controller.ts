import type { AuthedRequest } from "../middlewares/auth.middleware.ts";
import User from "../models/user.model.ts";

export const getMe = async (req: AuthedRequest, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.status(200).json({
      success: true,
      data: {
        id: user._id,
        email: user.email,
        name: user.fullName,
        role: user.role,
        bio: user.bio ?? "",
        profilePicture: user.profilePicture ?? "",
        phoneNumber: user.phoneNumber ?? "",
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateMe = async (req: AuthedRequest, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    const { fullName, bio, profilePicture, phoneNumber } = req.body || {};
    const updates: Record<string, unknown> = {};
    if (fullName !== undefined) updates.fullName = String(fullName).trim().slice(0, 100);
    if (bio !== undefined) updates.bio = String(bio).trim().slice(0, 200);
    if (profilePicture !== undefined) updates.profilePicture = String(profilePicture).trim();
    if (phoneNumber !== undefined) updates.phoneNumber = String(phoneNumber).trim();

    const updated = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: {
        id: updated._id,
        email: updated.email,
        name: updated.fullName,
        role: updated.role,
        bio: updated.bio ?? "",
        profilePicture: updated.profilePicture ?? "",
        phoneNumber: updated.phoneNumber ?? "",
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

