import e from "express";
import {
  getCrewAssignments,
  getCrewAssignment,
  createCrewAssignment,
  updateCrewAssignment,
  deleteCrewAssignment,
} from "../controllers/crewAssignment.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = e.Router();

router.get("/", getCrewAssignments);
router.get("/:id", getCrewAssignment);
router.post("/", requireAuth, requireRole("admin"), createCrewAssignment);
router.put("/:id", requireAuth, requireRole("admin"), updateCrewAssignment);
router.delete("/:id", requireAuth, requireRole("admin"),  deleteCrewAssignment);

export default router;
