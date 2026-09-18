import e from "express";
import {
  fetchFeaturedFilms,
  getFeaturedFilmsForManage,
  setFeaturedFilms,
} from "../controllers/featuredFilms.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = e.Router();

// Public — the homepage "Featured Selection" row.
router.get("/", fetchFeaturedFilms);

// Staff-only management.
router.get("/manage", requireAuth, requireRole("admin", "staff"), getFeaturedFilmsForManage);
router.put("/", requireAuth, requireRole("admin", "staff"), setFeaturedFilms);

export default router;
