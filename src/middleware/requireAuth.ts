import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/errors.js";

/**
 * Requires req.user, attached by the authenticateJWT middleware when the
 * request carries a valid access token (Bearer header or theatre.jwt
 * cookie). Missing, invalid, or expired tokens reach here without a user
 * and are rejected.
 * Authorization (roles) is requireAdmin's job.
 */
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (req.user) {
    next();
    return;
  }
  next(new HttpError(401, "Authentication required"));
}
