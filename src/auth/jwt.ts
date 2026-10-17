// jsonwebtoken is CJS without statically-detectable named exports, so raw
// Node ESM (tsx) rejects `import { sign } from "jsonwebtoken"`; the default
// import rides esModuleInterop instead.
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { randomUUID } from "node:crypto";

// jwt.sign expects seconds; cookie maxAge expects milliseconds.
export const JWT_CONFIG = {
  secret: config.jwtSecret,
  tokenExpiresIn: 60 * 15, // 15 min, seconds
  refreshSecret: config.refreshSecret,
  refreshExpiresIn: 60 * 60 * 24 * 7, // 7 days, seconds
};

export const ACCESS_TOKEN_MAX_AGE_MS = JWT_CONFIG.tokenExpiresIn * 1000;
export const REFRESH_TOKEN_MAX_AGE_MS = JWT_CONFIG.refreshExpiresIn * 1000;

type UserPayloadInput = {
  userId: string;
  username: string;
  tokenType: "access" | "refresh";
};

type UserPayload = UserPayloadInput & {
  jti: string;
};

// Signs a token of the given type. The random jti makes every token
// unique, so a future denylist could revoke individual tokens. Refresh
// tokens use their own secret, so one leaked key cannot forge the
// other token type.
export function signToken(payload: UserPayloadInput): string {
  const isAccess = payload.tokenType === "access";
  return jwt.sign(
    { ...payload, jti: randomUUID() },
    isAccess ? JWT_CONFIG.secret : JWT_CONFIG.refreshSecret,
    {
      expiresIn: isAccess
        ? JWT_CONFIG.tokenExpiresIn
        : JWT_CONFIG.refreshExpiresIn,
    },
  );
}

// Verifies with the type's own secret and enforces the matching type
// claim: an access token must never be accepted as a refresh token or
// the other way around — each type only works on its own endpoints.
function verifyTypedToken(
  tokenType: "access" | "refresh",
  token: string,
): UserPayload {
  const secret =
    tokenType === "access" ? JWT_CONFIG.secret : JWT_CONFIG.refreshSecret;
  try {
    const payload = jwt.verify(token, secret) as UserPayload;
    if (payload.tokenType !== tokenType) {
      throw new jwt.JsonWebTokenError("Invalid token type");
    }
    return payload;
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      throw err;
    }
    throw new jwt.JsonWebTokenError("Invalid token");
  }
}

export function verifyAccessToken(token: string): UserPayload {
  return verifyTypedToken("access", token);
}

export function verifyRefreshToken(token: string): UserPayload {
  return verifyTypedToken("refresh", token);
}
