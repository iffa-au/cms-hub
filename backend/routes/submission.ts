import e from "express";
import {
  createSubmission,
  getMySubmissions,
  getSubmission,
  adminListSubmissions,
  approveSubmission,
  rejectSubmission,
  updateSubmission,
} from "../controllers/submission.controller.ts";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.ts";

const router = e.Router();

// Public
router.get("/:id", getSubmission);

// User
router.post("/", requireAuth, createSubmission);
router.get("/my/list", requireAuth, getMySubmissions);
router.put("/:id", requireAuth, updateSubmission);

// Admin
router.get("/", requireAuth, requireRole("admin"), adminListSubmissions);
router.patch(
  "/:id/approve",
  requireAuth,
  requireRole("admin"),
  approveSubmission
);
router.patch(
  "/:id/reject",
  requireAuth,
  requireRole("admin"),
  rejectSubmission
);

export default router;
