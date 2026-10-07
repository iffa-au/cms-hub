import e from "express";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import {
  getDistributionEnquiries,
  getDistributionEnquiryById,
  createDistributionEnquiryPublic,
  deleteDistributionEnquiry,
} from "../controllers/distributionEnquiry.controller.js";

const router = e.Router();

router.get("/", requireAuth, requireRole("admin"), getDistributionEnquiries);
router.get("/:id", requireAuth, requireRole("admin"), getDistributionEnquiryById);
router.post("/", createDistributionEnquiryPublic); // public: the site's /distribution-enquiry form
router.delete("/:id", requireAuth, requireRole("admin"), deleteDistributionEnquiry);

export default router;
