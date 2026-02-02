import e from "express";
import {
  getAwardCategories,
  getAwardCategory,
  createAwardCategory,
  updateAwardCategory,
  deleteAwardCategory,
} from "../controllers/awardCategory.controller.js";

const router = e.Router();

router.get("/", getAwardCategories);
router.get("/:id", getAwardCategory);
// Temporarily disable auth for integration testing
router.post("/", createAwardCategory);
router.put("/:id", updateAwardCategory);
router.delete("/:id", deleteAwardCategory);

export default router;





