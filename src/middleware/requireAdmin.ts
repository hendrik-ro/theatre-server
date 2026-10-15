import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/errors.js";

// Must run after requireAuth, which attaches the loaded user to req.user.
// The 401 branch guards against this middleware being wired up without
// requireAuth in front of it.
export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    next(new HttpError(401, "Authentication required"));
    return;
  }
  if (req.user.role !== "admin") {
    next(new HttpError(403, "Admin access required"));
    return;
  }
  next();
}
