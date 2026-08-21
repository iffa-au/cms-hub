import e from "express";
import {
  fetchPartners,
  listPartners,
  createPartner,
  updatePartner,
  deletePartner,
} from "../controllers/partner.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = e.Router();

// Public — consumed by the Partner With Us page on the website.
router.get("/", fetchPartners);

// Staff-only management.
router.get("/manage", requireAuth, requireRole("admin", "staff"), listPartners);
router.post("/", requireAuth, requireRole("admin", "staff"), createPartner);
router.put("/:id", requireAuth, requireRole("admin", "staff"), updatePartner);
router.delete("/:id", requireAuth, requireRole("admin", "staff"), deletePartner);

export default router;
