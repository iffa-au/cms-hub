import e from "express";
import {
  getNominations,
  getNomination,
  createNomination,
  updateNomination,
  deleteNomination,
  fetchNomination,
} from "../controllers/nomination.controller.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";

const router = e.Router();

router.get("/fetchNomination", fetchNomination);
router.get("/", (req, res, next) => {
  // A year alone used to mean "public feed", but the CMS Nominations page
  // sends `year` too and got back the public shape (a bare array), which it
  // rendered as an empty list. The bearer token is what marks a staff
  // request; the public site never sends one (it uses /fetchNomination).
  const isStaffRequest = req.header("Authorization")?.startsWith("Bearer ");
  if (!isStaffRequest && req.query.year) {
    return fetchNomination(req, res);
  }
  next();
}, requireAuth, requireRole("admin", "staff"), getNominations); 
router.get("/:id", getNomination); 
router.post("/", requireAuth, requireRole("admin"), createNomination);
router.put("/:id", requireAuth, requireRole("admin"), updateNomination);
router.delete("/:id", requireAuth, requireRole("admin"), deleteNomination);

export default router;




