import e from "express";
import {
  fetchFestivals,
  fetchFestivalSettings,
  fetchFestivalBySlug,
  listFestivals,
  getFestivalById,
  createFestival,
  updateFestival,
  updateFestivalSettings,
  deleteFestival,
} from "../controllers/festival.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = e.Router();

/**
 * ROUTE ORDER IS LOAD-BEARING.
 *
 * Every literal path below must be registered before `/:id`, or Express matches
 * the literal as an id — `PUT /festivals/settings` would arrive at
 * `updateFestival` with `id === "settings"` and 404 on a cast error.
 *
 * By-slug lookups sit under `/slug/` for the same reason: a festival slugged
 * "manage" or "settings" must not be able to shadow a real route.
 */

// Public — consumed by the Festivals page on the website.
router.get("/", fetchFestivals);
router.get("/settings", fetchFestivalSettings);
router.get("/slug/:slug", fetchFestivalBySlug);

// Staff-only management. `/manage` includes drafts; the public routes never do.
router.get("/manage", requireAuth, requireRole("admin", "staff"), listFestivals);
router.get("/manage/:id", requireAuth, requireRole("admin", "staff"), getFestivalById);

router.put("/settings", requireAuth, requireRole("admin", "staff"), updateFestivalSettings);

router.post("/", requireAuth, requireRole("admin", "staff"), createFestival);
router.put("/:id", requireAuth, requireRole("admin", "staff"), updateFestival);
router.delete("/:id", requireAuth, requireRole("admin", "staff"), deleteFestival);

export default router;
