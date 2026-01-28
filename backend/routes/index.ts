import e from "express";
import authRoutes from "./auth.ts";
import languageRoutes from "./language.ts";
import contentTypeRoutes from "./contentType.ts";
import countryRoutes from "./country.ts";
import genreRoutes from "./genre.ts";
import awardCategoryRoutes from "./awardCategory.ts";
import crewMemberRoutes from "./crewMember.ts";
import crewRoleRoutes from "./crewRole.ts";
import submissionRoutes from "./submission.ts";
import nominationRoutes from "./nomination.ts";
import crewAssignmentRoutes from "./crewAssignment.ts";
import userRoutes from "./user.ts";

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
