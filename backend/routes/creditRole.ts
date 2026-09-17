import e from "express";
import {
  getCreditRoles,
  getCreditRole,
  createCreditRole,
  updateCreditRole,
  deleteCreditRole,
} from "../controllers/creditRole.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = e.Router();

// Public read, like the other lookup lists — the crew editor fetches this to
// populate its "Other Crew" dropdown, and role names are not sensitive.
router.get("/", getCreditRoles);
router.get("/:id", getCreditRole);

// Admin-only writes. Note this deliberately does NOT copy /genres and
// /countries, whose write routes still carry a "temporarily disable auth for
// integration testing" comment and no auth at all.
router.post("/", requireAuth, requireRole("admin"), createCreditRole);
router.put("/:id", requireAuth, requireRole("admin"), updateCreditRole);
router.delete("/:id", requireAuth, requireRole("admin"), deleteCreditRole);

export default router;
