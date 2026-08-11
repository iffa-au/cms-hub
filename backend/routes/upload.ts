import e from "express";
import { requestUploadUrl } from "../controllers/upload.controller.js";

const router = e.Router();

// Public — the film submission form is unauthenticated, same as POST /submissions.
router.post("/presign", requestUploadUrl);

export default router;
