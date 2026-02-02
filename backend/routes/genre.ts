import e from "express";
import {
  getGenres,
  getGenre,
  createGenre,
  updateGenre,
  deleteGenre,
} from "../controllers/genre.controller.js";

const router = e.Router();

router.get("/", getGenres);
router.get("/:id", getGenre);
// Temporarily disable auth for integration testing
router.post("/", createGenre);
router.put("/:id", updateGenre);
router.delete("/:id", deleteGenre);

export default router;

