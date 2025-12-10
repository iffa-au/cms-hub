import e from "express";
import authRoutes from "./auth.ts";

const router = e.Router();

router.use("/auth", authRoutes);

export default router;
