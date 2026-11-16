import e from "express";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import {
  createEventRegistrationPublic,
  deleteEventRegistration,
  getEventRegistrationById,
  getEventRegistrations,
  updateEventRegistration,
} from "../controllers/eventRegistration.controller.js";

const router = e.Router();

// Public: the /attend-event form on iffa-2026. Write-only — it answers with a
// message, never with the stored document or anyone else's.
router.post("/", createEventRegistrationPublic);

// The guest list is admin-only, every verb.
router.get("/", requireAuth, requireRole("admin"), getEventRegistrations);
router.get("/:id", requireAuth, requireRole("admin"), getEventRegistrationById);
router.patch("/:id", requireAuth, requireRole("admin"), updateEventRegistration);
router.delete("/:id", requireAuth, requireRole("admin"), deleteEventRegistration);

export default router;
