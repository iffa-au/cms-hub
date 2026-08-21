import e from "express";
import {
  requestUploadUrl,
  requestPartnerUploadUrl,
} from "../controllers/upload.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = e.Router();

// Public — the film submission form is unauthenticated, same as POST /submissions.
router.post("/presign", requestUploadUrl);

// Staff-only — partner logos are managed from the CMS, never by the public.
router.post(
  "/presign/partner",
  requireAuth,
  requireRole("admin", "staff"),
  requestPartnerUploadUrl,
);

export default router;
