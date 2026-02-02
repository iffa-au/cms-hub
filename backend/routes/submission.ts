import e from "express";
import {
  createSubmission,
  createSubmissionPublic,
  getMySubmissions,
  getSubmission,
  getSubmissionOverview,
  adminListSubmissions,
  approveSubmission,
  rejectSubmission,
  updateSubmission,
  deleteSubmission,
} from "../controllers/submission.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = e.Router();

// Public
router.get("/:id/overview", getSubmissionOverview);
router.get("/:id", getSubmission);
router.post("/public", createSubmissionPublic);

// User

router.post("/", requireAuth, requireRole("admin", "staff"), createSubmission);
router.get("/my/list", requireAuth, getMySubmissions);
router.put("/:id", requireAuth, updateSubmission);

// Admin/Staff review and listing
router.get("/", requireAuth, requireRole("admin", "staff"), adminListSubmissions);
router.delete(
  "/:id",
  requireAuth,
  requireRole("admin", "staff"),
  deleteSubmission
);
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
