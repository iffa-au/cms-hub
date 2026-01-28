import { z } from "zod";

export const signInSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
});

export const signUpSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters long"),
  // name: z.string().min(8, "Name must be at least 8 characters long"),
});
// .refine((data) => data.password === data.confirmPassword, {
//   message: "Passwords do not match", // error message if passwords don't match
//   path: ["confirmPassword"], // set the error on the confirmPassword field
// });

// export const veriryEmailSchema = z.object({
//   token: z.string().min(1, "Token is required"),
// });
