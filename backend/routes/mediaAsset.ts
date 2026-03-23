import e from "express";
import {
  getMediaAssets,
  getMediaAssetByTitle,
  createMediaAsset,
} from "../controllers/mediaAsset.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = e.Router();

router.get("/", requireAuth, requireRole("admin", "staff"), getMediaAssets);
router.get("/title/:title", getMediaAssetByTitle);
router.post("/", requireAuth, requireRole("admin"), createMediaAsset);

export default router;
