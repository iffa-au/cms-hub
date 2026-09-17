import e from "express";
import {
  fetchPodcasts,
  fetchPodcastBySlug,
  listPodcasts,
  getPodcastById,
  createPodcast,
  updatePodcast,
  deletePodcast,
} from "../controllers/podcast.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = e.Router();

/**
 * ROUTE ORDER IS LOAD-BEARING — same rule as festival.ts.
 *
 * Every literal path must be registered before `/:id`, or Express matches the
 * literal as an id. By-slug lookups sit under `/slug/` so an episode slugged
 * "manage" can never shadow the staff route.
 */

// Public — consumed by the Podcast page on the website.
router.get("/", fetchPodcasts);
router.get("/slug/:slug", fetchPodcastBySlug);

// Staff-only management. `/manage` includes drafts; the public routes never do.
router.get("/manage", requireAuth, requireRole("admin", "staff"), listPodcasts);
router.get("/manage/:id", requireAuth, requireRole("admin", "staff"), getPodcastById);

router.post("/", requireAuth, requireRole("admin", "staff"), createPodcast);
router.put("/:id", requireAuth, requireRole("admin", "staff"), updatePodcast);
router.delete("/:id", requireAuth, requireRole("admin", "staff"), deletePodcast);

export default router;
