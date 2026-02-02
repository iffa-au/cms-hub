import e from "express";
import { signUpSchema, signInSchema } from "../libs/validateSchema.js";
import { validateData } from "../middlewares/validate.middleware.js";
import {
  login,
  logout,
  refresh,
  register,
} from "../controllers/auth.controller.js";
const router = e.Router();

router.post("/register", validateData(signUpSchema), register);
router.post("/login", validateData(signInSchema), login);
router.post("/refresh", refresh);
router.post("/logout", logout);

export default router;
