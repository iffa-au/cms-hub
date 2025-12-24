import e from "express";
import {
  getAwardCategories,
  getAwardCategory,
  createAwardCategory,
  updateAwardCategory,
  deleteAwardCategory,
} from "../controllers/awardCategory.controller.ts";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.ts";

const router = e.Router();

router.get("/", getAwardCategories);
router.get("/:id", getAwardCategory);
router.post("/", requireAuth, requireRole("admin"), createAwardCategory);
router.put("/:id", requireAuth, requireRole("admin"), updateAwardCategory);
router.delete("/:id", requireAuth, requireRole("admin"), deleteAwardCategory);

export default router;





