import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../auth/jwt.js";
import { COOKIE_NAME, getCookie } from "../auth/cookies.js";
import { isUUID } from "../db/queries/utils.js";
import { getUserById } from "../db/queries/users.js";

const BEARER_PREFIX = "Bearer ";

// Best-effort: mounted globally, it attaches req.user when the request
// carries a valid access token (Bearer header or theatre.jwt cookie) and
// otherwise passes through silently. Enforcing authentication — and
// rejecting the request — is requireAuth's job per route; an invalid or
// expired token here simply falls through to a 401 from requireAuth.
export function authenticateJWT(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith(BEARER_PREFIX)) {
    token = authHeader.slice(BEARER_PREFIX.length);
  }

  if (!token) {
    token = getCookie(COOKIE_NAME, req.headers.cookie);
  }

  if (!token) {
    next();
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    if (!payload || !isUUID(payload.userId)) {
      next();
      return;
    }

    getUserById(payload.userId)
      .then((user) => {
        if (user) {
          req.user = user;
        }
        next();
      })
      .catch(next);
  } catch {
    next();
  }
}
