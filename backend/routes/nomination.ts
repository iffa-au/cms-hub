import e from "express";
import {
  getNominations,
  getNomination,
  createNomination,
  updateNomination,
  deleteNomination,
} from "../controllers/nomination.controller.ts";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.ts";

const router = e.Router();

router.get("/", requireAuth, requireRole("admin", "staff"), getNominations); 
router.get("/:id", getNomination); 
router.post("/", requireAuth, requireRole("admin"), createNomination);
router.put("/:id", requireAuth, requireRole("admin"), updateNomination);
router.delete("/:id", requireAuth, requireRole("admin"), deleteNomination);

export default router;




