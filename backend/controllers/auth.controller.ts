import User from "../models/user.model.ts";
import jwt from "jsonwebtoken";
import aj from "../libs/arcjet.ts";
import { generateToken, verifyRefreshToken } from "../utils/token.ts";

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV !== "development",
  sameSite: process.env.NODE_ENV === "development" ? "lax" : "strict",
  path: "/",
  maxAge: 1000 * 60 * 60 * 24 * 14, // 14 days
};

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const decision = await aj.protect(req, { email });

    if (decision.isDenied()) {
      if (decision.reason.isEmail()) {
        return res.status(403).json({ message: "Invalid Email Address" });
      }
    } // Handle other denial reasons if needed

    // check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const newUser = new User({ fullName: name, email, password });
    await newUser.save();

    const { accessToken, refreshToken } = generateToken({
      _id: newUser._id.toString(),
      role: newUser.role,
    });
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);

    res.status(201).json({
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
    res.status(500).json({ message: "Internal server error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect)
      return res.status(401).json({ message: "Invalid credentials" });

    const { accessToken, refreshToken } = generateToken({
      _id: user._id.toString(),
      role: user.role,
    });
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);

    res.status(200).json({
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
    res.status(500).json({ message: "Internal server error" });
  }
};

export const refresh = async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (!token) return res.status(401).json({ message: "Missing refresh token" });

  try {
    const payload = verifyRefreshToken(token);
    const { accessToken, refreshToken } = generateToken({
      _id: payload.sub,
      role: payload.role,
    });
    res.cookie("refreshToken", refreshToken, refreshCookieOptions);
    res.status(200).json({
      message: "Token refreshed successfully",
      accessToken,
    });
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Invalid/Expired refresh token" });
  }
};

export const logout = async (req, res) => {
  res.clearCookie("refreshToken", { path: "/" });
  res.status(200).json({ message: "Logged out successfully" });
};
