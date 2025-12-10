import e from "express";
import { signUpSchema, signInSchema } from "../libs/validateSchema.ts";
import { validateData } from "../middlewares/validate.middleware.ts";
import {
  login,
  logout,
  refresh,
  register,
} from "../controllers/auth.controller.ts";
const router = e.Router();

router.post("/register", validateData(signUpSchema), register);
router.post("/login", validateData(signInSchema), login);
router.post("/refresh", refresh);
router.post("/logout", logout);

export default router;
