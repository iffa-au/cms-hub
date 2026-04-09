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
  fetchSubmission,
  fetchWinner,
  fetchWinnerDetailed,
} from "../controllers/submission.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = e.Router();

// Public
router.get("/fetchSubmission", fetchSubmission);
router.get("/fetchWinner", fetchWinner);
router.get("/fetchWinnerDetailed", fetchWinnerDetailed);
router.get("/", (req, res, next) => {
  if (req.query.year) {
    return fetchSubmission(req, res);
  }
  next();
}, (req, res, next) => {
  // If it's the admin/staff list, it will require auth
  requireAuth(req as any, res, next);
}, requireRole("admin", "staff"), adminListSubmissions);

router.get("/:id/overview", getSubmissionOverview);
router.get("/:id", getSubmission);
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
