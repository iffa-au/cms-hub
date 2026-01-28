import e from "express";
import { requireAuth } from "../middlewares/auth.middleware.ts";
import { getMe, updateMe } from "../controllers/user.controller.ts";

const router = e.Router();

router.get("/me", requireAuth, getMe);
router.put("/me", requireAuth, updateMe);

export default router;

