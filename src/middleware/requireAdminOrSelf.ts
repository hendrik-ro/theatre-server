import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/errors.js";
import { requireAdmin } from "./requireAdmin.js";

// Must run after requireAuth, which attaches req.user. Allows regular
// users to act on their own id and defers everything else to requireAdmin.
// The 401 branch guards against this middleware being wired up without
// requireAuth in front of it.
export function requireAdminOrSelf(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    next(new HttpError(401, "Authentication required"));
    return;
  }
  if (req.user.id === req.params.id) {
    next();
    return;
  }
  requireAdmin(req, res, next);
}
