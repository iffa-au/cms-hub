import e from "express";
import {
  requestUploadUrl,
  requestPartnerUploadUrl,
  requestSubmissionCrewUploadUrl,
  requestFestivalUploadUrl,
  requestFestivalPageUploadUrl,
} from "../controllers/upload.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = e.Router();

// Public — the film submission form is unauthenticated, same as POST /submissions.
router.post("/presign", requestUploadUrl);

// Staff-only — crew photos replaced from the CMS after submission. The public
// form uses /presign above, which takes a browser-generated ref instead.
router.post(
  "/presign/submission-crew",
  requireAuth,
  requireRole("admin", "staff"),
  requestSubmissionCrewUploadUrl,
);

// Staff-only — partner logos are managed from the CMS, never by the public.
router.post(
  "/presign/partner",
  requireAuth,
  requireRole("admin", "staff"),
  requestPartnerUploadUrl,
);

// Staff-only — festival artwork is managed from the CMS, never by the public.
router.post(
  "/presign/festival",
  requireAuth,
  requireRole("admin", "staff"),
  requestFestivalUploadUrl,
);

// Staff-only — hero and award images for the Festivals page itself.
router.post(
  "/presign/festival-page",
  requireAuth,
  requireRole("admin", "staff"),
  requestFestivalPageUploadUrl,
);

export default router;
