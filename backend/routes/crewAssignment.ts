import e from "express";
import {
  getCrewAssignments,
  getCrewAssignment,
  createCrewAssignment,
  updateCrewAssignment,
  deleteCrewAssignment,
} from "../controllers/crewAssignment.controller.ts";
import { requireAuth } from "../middlewares/auth.middleware.ts";

const router = e.Router();

router.get("/", getCrewAssignments);
router.get("/:id", getCrewAssignment);
router.post("/", requireAuth, createCrewAssignment);
router.put("/:id", requireAuth, updateCrewAssignment);
router.delete("/:id", requireAuth, deleteCrewAssignment);

export default router;




