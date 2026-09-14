import e from "express";
import { getWinners } from "../controllers/winner.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = e.Router();

// Admin/Staff only. Unlike GET /nominations, this never hands off to a public
// feed on a `year` query, so it can serve a year-scoped winners list.
router.get("/", requireAuth, requireRole("admin", "staff"), getWinners);

export default router;
