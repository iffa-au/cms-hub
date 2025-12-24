import e from "express";
import {
  getContentTypes,
  getContentType,
  createContentType,
  updateContentType,
  deleteContentType,
} from "../controllers/contentType.controller.ts";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.ts";

const router = e.Router();

router.get("/", getContentTypes);
router.get("/:id", getContentType);
router.post("/", requireAuth, requireRole("admin"), createContentType);
router.put("/:id", requireAuth, requireRole("admin"), updateContentType);
router.delete("/:id", requireAuth, requireRole("admin"), deleteContentType);

export default router;







