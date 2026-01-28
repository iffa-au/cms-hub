import e from "express";
import {
  createSubmission,
  getMySubmissions,
  getSubmission,
  getSubmissionOverview,
  adminListSubmissions,
  approveSubmission,
  rejectSubmission,
  updateSubmission,
} from "../controllers/submission.controller.ts";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.ts";

const router = e.Router();

// Public
router.get("/:id/overview", getSubmissionOverview);
router.get("/:id", getSubmission);

// User

router.post("/", requireAuth, createSubmission);
router.get("/my/list", requireAuth, getMySubmissions);
router.put("/:id", requireAuth, updateSubmission);

// Admin/Staff review and listing
router.get("/", requireAuth, requireRole("admin", "staff"), adminListSubmissions);
router.patch(
  "/:id/approve",
  requireAuth,
  requireRole("admin", "staff"),
  approveSubmission
);
router.patch(
  "/:id/reject",
  requireAuth,
  requireRole("admin", "staff"),
  rejectSubmission
);

export default router;
