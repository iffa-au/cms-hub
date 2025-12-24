import e from "express";
import {
  getLanguages,
  getLanguage,
  createLanguage,
  updateLanguage,
  deleteLanguage,
} from "../controllers/language.controller.ts";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.ts";

const router = e.Router();

router.get("/", getLanguages);
router.get("/:id", getLanguage);
router.post("/", requireAuth, requireRole("admin"), createLanguage);
router.put("/:id", requireAuth, requireRole("admin"), updateLanguage);
router.delete("/:id", requireAuth, requireRole("admin"), deleteLanguage);

export default router;




