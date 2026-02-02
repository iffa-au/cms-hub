import e from "express";
import {
  getCountries,
  getCountry,
  createCountry,
  updateCountry,
  deleteCountry,
} from "../controllers/country.controller.js";

const router = e.Router();

router.get("/", getCountries);
router.get("/:id", getCountry);
// Temporarily disable auth for integration testing
router.post("/", createCountry);
router.put("/:id", updateCountry);
router.delete("/:id", deleteCountry);

export default router;
