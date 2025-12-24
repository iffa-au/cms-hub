import { verifyAccessToken } from "../utils/token.ts";
import type { Request, Response, NextFunction } from "express";
import type { JwtPayload } from "../utils/token.ts";

export interface AuthedRequest extends Request {
  user?: JwtPayload;
}

export function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const auth = req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing token" });
  }
  const token = auth.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid/Expired token" });
  }
}

export function requireRole(...roles: Array<"user" | "staff" | "admin">) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!roles.includes(req.user.role as "user" | "staff" | "admin")) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}
