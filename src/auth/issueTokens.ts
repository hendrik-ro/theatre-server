import type { Response } from "express";
import { hashToken } from "./hash.js";
import { REFRESH_TOKEN_MAX_AGE_MS, signToken } from "./jwt.js";
import { setAuthCookies } from "./cookies.js";
import type { User } from "../models/users.js";
import { createRefreshToken } from "../db/queries/refreshTokens.js";

// Signs an access + refresh pair, persists the refresh token (hashed) as
// the user's single active row, and ships both as HTTP-only cookies.
// The upsert replaces any previous token, so login and refresh both rotate.
export async function issueTokens(res: Response, user: User): Promise<void> {
  const access = signToken({
    userId: user.id,
    username: user.username,
    tokenType: "access",
  });
  const refresh = signToken({
    userId: user.id,
    username: user.username,
    tokenType: "refresh",
  });

  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_MAX_AGE_MS);
  await createRefreshToken(user.id, hashToken(refresh), expiresAt);

  setAuthCookies(res, access, refresh);
}
