import { z, ZodError } from "zod";

const validateData = (schema: z.ZodObject<any>) => {
  return (req, res, next) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          status: "error",
          errors: error.issues.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })),
        });
      }
      return res.status(500).json({
        status: "error",
        error: "Internal Server Error",
      });
    }
  };
};

export { validateData };
