import e from "express";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import { getFilmEnquiryById } from "../controllers/filmEnquiry.controller.js";
import authRoutes from "./auth.js";
import languageRoutes from "./language.js";
import contentTypeRoutes from "./contentType.js";
import countryRoutes from "./country.js";
import genreRoutes from "./genre.js";
import awardCategoryRoutes from "./awardCategory.js";
import crewMemberRoutes from "./crewMember.js";
import crewRoleRoutes from "./crewRole.js";
import submissionRoutes from "./submission.js";
import nominationRoutes from "./nomination.js";
import crewAssignmentRoutes from "./crewAssignment.js";
import userRoutes from "./user.js";
import filmEnquiryRoutes from "./filmEnquiry.js";

const router = e.Router();

router.get("/getfilmenquiry/:id", requireAuth, requireRole("admin"), getFilmEnquiryById);

router.use("/auth", authRoutes);
router.use("/languages", languageRoutes);
router.use("/content-types", contentTypeRoutes);
router.use("/countries", countryRoutes);
router.use("/genres", genreRoutes);
router.use("/award-categories", awardCategoryRoutes);
router.use("/crew-members", crewMemberRoutes);
router.use("/crew-roles", crewRoleRoutes);
router.use("/submissions", submissionRoutes);
router.use("/nominations", nominationRoutes);
router.use("/crew-assignments", crewAssignmentRoutes);
router.use("/users", userRoutes);
router.use("/film-enquiries", filmEnquiryRoutes);

export default router;
