import e from "express";
import {
  getContentTypes,
  getContentType,
  createContentType,
  updateContentType,
  deleteContentType,
} from "../controllers/contentType.controller.js";

const router = e.Router();

router.get("/", getContentTypes);
router.get("/:id", getContentType);
// Temporarily disable auth for integration testing
router.post("/", createContentType);
router.put("/:id", updateContentType);
router.delete("/:id", deleteContentType);

export default router;







