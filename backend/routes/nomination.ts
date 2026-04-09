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
  if (req.query.year) {
    return fetchNomination(req, res);
  }
  next();
}, requireAuth, requireRole("admin", "staff"), getNominations); 
router.get("/:id", getNomination); 
router.post("/", requireAuth, requireRole("admin"), createNomination);
router.put("/:id", requireAuth, requireRole("admin"), updateNomination);
router.delete("/:id", requireAuth, requireRole("admin"), deleteNomination);

export default router;




