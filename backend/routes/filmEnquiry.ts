import e from "express";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import {
  getFilmEnquiries,
  getFilmEnquiryById,
  createFilmEnquiryPublic,
  deleteFilmEnquiry,
  updateFilmEnquiry,
} from "../controllers/filmEnquiry.controller.js";

const router = e.Router();

router.get("/", requireAuth, requireRole("admin"), getFilmEnquiries);
router.get("/:id", requireAuth, requireRole("admin"), getFilmEnquiryById);
router.post("/", createFilmEnquiryPublic); // for people in IFFA to submit film enquiries
router.delete("/:id", requireAuth, requireRole("admin"), deleteFilmEnquiry);
router.put("/:id", requireAuth, requireRole("admin"), updateFilmEnquiry);

export default router;
