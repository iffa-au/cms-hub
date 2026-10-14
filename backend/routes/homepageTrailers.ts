import e from "express";
import {
  fetchHomepageTrailers,
  getHomepageTrailersForManage,
  setHomepageTrailers,
} from "../controllers/homepageTrailers.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = e.Router();

// Public — the homepage trailer slots.
router.get("/", fetchHomepageTrailers);

// Staff-only management.
router.get("/manage", requireAuth, requireRole("admin", "staff"), getHomepageTrailersForManage);
router.put("/", requireAuth, requireRole("admin", "staff"), setHomepageTrailers);

export default router;
