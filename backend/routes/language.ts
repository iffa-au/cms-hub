import e from "express";
import {
  getLanguages,
  getLanguage,
  createLanguage,
  updateLanguage,
  deleteLanguage,
} from "../controllers/language.controller.ts";

const router = e.Router();

router.get("/", getLanguages);
router.get("/:id", getLanguage);
// Temporarily disable auth for integration testing
router.post("/", createLanguage);
router.put("/:id", updateLanguage);
router.delete("/:id", deleteLanguage);

export default router;




