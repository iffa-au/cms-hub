import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import aj from "../libs/arcjet.js";
import { generateToken, verifyRefreshToken } from "../utils/token.js";

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV !== "development",
  sameSite: process.env.NODE_ENV === "development" ? "lax" : "strict",
  path: "/",
  maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
};

export const register = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    const decision = await aj.protect(req, { email });
    if (decision.isDenied()) {
      if (decision.reason.isEmail()) {
        return res
          .status(403)
          .json({ success: false, message: "Invalid Email Address" });
      }
    } // Handle other denial reasons if needed

    if (!fullName || fullName.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "Full name is required" });
    }
    // check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });

    const newUser = new User({ fullName: fullName.trim(), email, password });
    await newUser.save();

    const { accessToken, refreshToken } = generateToken({
      _id: newUser._id.toString(),
      role: newUser.role,
    });
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        id: newUser._id,
        email: newUser.email,
        name: newUser.fullName,
        role: newUser.role,
      },
      accessToken,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    const user = await User.findOne({ email }).select("+password");
    if (!user)
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });

    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect)
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });

    const { accessToken, refreshToken } = generateToken({
      _id: user._id.toString(),
      role: user.role,
    });
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);

    res.status(200).json({
      success: true,
      message: "User signed in successfully",
      user: {
        id: user._id,
        email: user.email,
        name: user.fullName,
        role: user.role,
      },
      accessToken,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const refresh = async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token)
    return res
      .status(401)
      .json({ success: false, message: "Missing refresh token" });

  try {
    const payload = verifyRefreshToken(token);
    const { accessToken, refreshToken } = generateToken({
      _id: payload.sub,
      role: payload.role,
    });
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);
    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      accessToken,
    });
  } catch (error) {
    console.error(error);
    res
      .status(401)
      .json({ success: false, message: "Invalid/Expired refresh token" });
  }
};

export const logout = async (req, res) => {
  res.clearCookie("refreshToken", { path: "/" });
  res.status(200).json({ success: true, message: "Logged out successfully" });
};
