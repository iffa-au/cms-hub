import e from "express";
import {
  getCountries,
  getCountry,
  createCountry,
  updateCountry,
  deleteCountry,
} from "../controllers/country.controller.ts";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.ts";

const router = e.Router();

router.get("/", getCountries);
router.get("/:id", getCountry);
router.post("/", requireAuth, requireRole("admin"), createCountry);
router.put("/:id", requireAuth, requireRole("admin"), updateCountry);
router.delete("/:id", requireAuth, requireRole("admin"), deleteCountry);

export default router;
