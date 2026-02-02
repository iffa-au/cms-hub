import e from "express";
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

const router = e.Router();

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

export default router;
