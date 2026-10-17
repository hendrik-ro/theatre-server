import request from "supertest";
import type { Express } from "express";
import { expect } from "vitest";

// The default user for auth tests; registerUser creates them.
export const registerInput = {
  username: "movielover",
  email: "movielover@example.com",
  password: "testpassword1000",
};

// Extracts a cookie's raw value from a Set-Cookie header list without
// assuming header order — the server sets several auth cookies and
// their sequence is an implementation detail.
export function cookieValue(
  setCookie: unknown,
  name: string,
): string | undefined {
  const headers = Array.isArray(setCookie) ? setCookie : [String(setCookie)];
  const header = headers.find((h) => h.startsWith(`${name}=`));
  return header?.split(";")[0]!.split("=").slice(1).join("=");
}

// Registers the default user — the shared precondition of most auth
// tests — asserting the 201 so callers can rely on it having worked.
export async function registerUser(app: Express): Promise<void> {
  const res = await request(app)
    .post("/api/users/register")
    .send(registerInput);
  expect(res.status).toBe(201);
}
