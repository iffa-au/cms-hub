import e from "express";
import {
  getGenres,
  getGenre,
  createGenre,
  updateGenre,
  deleteGenre,
} from "../controllers/genre.controller.ts";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.ts";

const router = e.Router();

router.get("/", getGenres);
router.get("/:id", getGenre);
router.post("/", requireAuth, requireRole("admin"), createGenre);
router.put("/:id", requireAuth, requireRole("admin"), updateGenre);
router.delete("/:id", requireAuth, requireRole("admin"), deleteGenre);

export default router;








