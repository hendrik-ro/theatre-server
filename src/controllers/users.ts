import type { Request } from "express";
import { hashPassword, hashToken, verifyPassword } from "../auth/hash.js";
import type { AsyncRequestHandler } from "../utils/asyncHandler.js";
import {
  userLoginSchema,
  userRegistrationSchema,
  type User,
} from "../models/users.js";
import {
  createUser,
  getUserById,
  getUserByUsername,
  setLastLogin,
} from "../db/queries/users.js";
import { verifyRefreshToken } from "../auth/jwt.js";
import { issueTokens } from "../auth/issueTokens.js";
import {
  clearAuthCookies,
  getCookie,
  REFRESH_COOKIE_NAME,
} from "../auth/cookies.js";
import {
  getUserIdByRefreshToken,
  revokeRefreshToken,
} from "../db/queries/refreshTokens.js";
import { HttpError } from "../utils/errors.js";

// Unreachable in a correctly wired app: the routes below all run behind
// requireAuth, which guarantees req.user. Guards the optional typing
// instead of asserting it away.
function requireUser(req: Request): User {
  const user = req.user;
  if (!user) {
    throw new Error("requireAuth middleware not mounted");
  }
  return user;
}

export const usersRegister: AsyncRequestHandler = async (req, res) => {
  const input = userRegistrationSchema.parse(req.body);
  const hash = await hashPassword(input.password);
  if (!hash) {
    throw new Error("Password hashing failed");
  }
  const newUser = await createUser(input.username, input.email, hash);

  await issueTokens(res, newUser);
  await setLastLogin(newUser.id);

  // Registration logs the user in straight away; the client confirms
  // through GET /api/users/me.
  res.status(201).json({ message: `User ${newUser.username} created` });
};

export const usersLogin: AsyncRequestHandler = async (req, res) => {
  const input = userLoginSchema.parse(req.body);
  const user = await getUserByUsername(input.username);
  // Same response for unknown email and wrong password: answering
  // differently leaks which emails are registered.
  if (!user) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }
  const isValid = await verifyPassword(input.password, user.passwordHash);
  if (isValid === null) {
    throw new Error("Password verification failed");
  }
  if (!isValid) {
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  await issueTokens(res, user);
  await setLastLogin(user.id);

  res.status(200).json({ username: user.username });
};

export const usersLogout: AsyncRequestHandler = async (req, res) => {
  const user = requireUser(req);
  await revokeRefreshToken(user.id);
  clearAuthCookies(res);

  res.status(200).json({ message: "Logged out" });
};

// requireAuth must have run; it attaches the authenticated user to req.user.
export const usersMe: AsyncRequestHandler = async (req, res) => {
  const user = requireUser(req);
  res.status(200).json({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
  });
};

// Refreshes the JWT pair from the HTTP-only refresh cookie. Unauthenticated
// by design: the access token may well have expired — that is its purpose.
// The presented token must verify, match the user's single active database
// row (hash), and then gets replaced by a new pair (rotation).
export const usersRefresh: AsyncRequestHandler = async (req, res) => {
  const token = getCookie(REFRESH_COOKIE_NAME, req.headers.cookie);
  if (!token) {
    throw new HttpError(401, "Refresh token required");
  }
  const payload = verifyRefreshToken(token);
  const rowUserId = await getUserIdByRefreshToken(hashToken(token));
  if (!rowUserId || rowUserId !== payload.userId) {
    throw new HttpError(401, "Invalid refresh token");
  }
  const user = await getUserById(rowUserId);
  if (!user) {
    throw new HttpError(401, "Invalid refresh token");
  }

  await issueTokens(res, user);

  res.status(200).json({ message: "Token refreshed" });
};
