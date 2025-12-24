import e from "express";
import {
  getCrewMembers,
  getCrewMember,
  createCrewMember,
  updateCrewMember,
  deleteCrewMember,
} from "../controllers/crewMember.controller.ts";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.ts";

const router = e.Router();

router.get("/", getCrewMembers);
router.get("/:id", getCrewMember);
router.post("/", requireAuth, requireRole("admin"), createCrewMember);
router.put("/:id", requireAuth, requireRole("admin"), updateCrewMember);
router.delete("/:id", requireAuth, requireRole("admin"), deleteCrewMember);

export default router;





