import e from "express";
import {
  signUpSchema,
  signInSchema,
  veriryEmailSchema,
} from "../libs/validateSchema.ts";
import { validateData } from "../middlewares/validate.middleware.ts";
