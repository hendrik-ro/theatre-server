import type { Response } from "express";
import { config } from "../config.js";
import { ACCESS_TOKEN_MAX_AGE_MS, REFRESH_TOKEN_MAX_AGE_MS } from "./jwt.js";

export const COOKIE_NAME = "theatre.jwt";
export const REFRESH_COOKIE_NAME = "theatre.refresh";

// Hardening attributes shared by both auth cookies. clearCookie must
// repeat them (path at minimum) or browsers keep the cookie.
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.env === "production",
  path: "/",
};

// Minimal Cookie-header lookup for the auth cookies; full cookie-parser
// is not warranted for two known names. The indexOf slice keeps any "="
// inside a value intact, and express URL-encodes values when setting.
export function getCookie(
  name: string,
  cookieHeader?: string,
): string | undefined {
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(";")) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq > 0 && trimmed.slice(0, eq) === name) {
      return decodeURIComponent(trimmed.slice(eq + 1));
    }
  }
  return undefined;
}

export function setAuthCookies(
  res: Response,
  access: string,
  refresh: string,
): void {
  res.cookie(COOKIE_NAME, access, {
    ...COOKIE_OPTIONS,
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });
  res.cookie(REFRESH_COOKIE_NAME, refresh, {
    ...COOKIE_OPTIONS,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);
  res.clearCookie(REFRESH_COOKIE_NAME, COOKIE_OPTIONS);
}
