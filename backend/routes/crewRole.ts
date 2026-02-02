import e from "express";
import {
  getCrewRoles,
  getCrewRole,
  createCrewRole,
  updateCrewRole,
  deleteCrewRole,
} from "../controllers/crewRole.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = e.Router();

router.get("/", getCrewRoles);
router.get("/:id", getCrewRole);
router.post("/", requireAuth, requireRole("admin"), createCrewRole);
router.put("/:id", requireAuth, requireRole("admin"), updateCrewRole);
router.delete("/:id", requireAuth, requireRole("admin"), deleteCrewRole);

export default router;









