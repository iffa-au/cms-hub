import e from "express";
import {
  getCrewMembers,
  getCrewMember,
  createCrewMember,
  updateCrewMember,
  deleteCrewMember,
} from "../controllers/crewMember.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = e.Router();

router.get("/", getCrewMembers);
router.get("/:id", getCrewMember);
// Staff as well as admin: crew is edited from the CMS like submissions are.
// requireAuth alone let any self-registered /auth/register account write here.
router.post("/", requireAuth, requireRole("admin", "staff"), createCrewMember);
router.put("/:id", requireAuth, requireRole("admin", "staff"), updateCrewMember);
router.delete("/:id", requireAuth, requireRole("admin", "staff"), deleteCrewMember);
export default router;





