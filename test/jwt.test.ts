import request from "supertest";
import type superagent from "superagent";
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { app } from "../src/server.js";
import { db } from "../src/db/index.js";
import { refreshTokens } from "../src/db/schema/refreshTokens.sql.js";
import {
  deleteUser,
  getUserByEmail,
  resetUsers,
} from "../src/db/queries/users.js";
import { hashToken } from "../src/auth/hash.js";
import { cookieValue, registerInput, registerUser } from "./helpers.js";

// Registers the default user and logs in, returning the raw token pair.
async function login(): Promise<{ access: string; refresh: string }> {
  await registerUser(app);

  const res = await request(app).post("/api/users/login").send({
    username: registerInput.username,
    password: registerInput.password,
  });
  expect(res.status).toBe(200);

  const access = cookieValue(res.headers["set-cookie"], "theatre.jwt");
  const refresh = cookieValue(res.headers["set-cookie"], "theatre.refresh");
  expect(access).toBeDefined();
  expect(refresh).toBeDefined();
  return { access: access!, refresh: refresh! };
}

// Calls POST /refresh presenting the given token as the refresh cookie.
function refreshWith(token: string | undefined): Promise<superagent.Response> {
  const req = request(app).post("/api/users/refresh");
  return token === undefined
    ? req
    : req.set("Cookie", `theatre.refresh=${token}`);
}

function authedRequest(token: string, cookieName: string): request.Test {
  return request(app)
    .get("/api/users/me")
    .set("Cookie", `${cookieName}=${token}`);
}

describe("jwt flow", () => {
  beforeEach(async () => {
    await resetUsers();
  });

  describe("token issuance", () => {
    it("login sets both cookies with hardening attributes", async () => {
      await registerUser(app);

      const res = await request(app).post("/api/users/login").send({
        username: registerInput.username,
        password: registerInput.password,
      });
      expect(res.status).toBe(200);

      const headers = (res.headers["set-cookie"] as unknown as string[]) ?? [
        res.headers["set-cookie"],
      ];

      // Hardening attributes on every auth cookie.
      for (const name of ["theatre.jwt", "theatre.refresh"]) {
        const header = headers.find((h) => h.startsWith(`${name}=`));
        expect(header, `${name} cookie missing`).toBeDefined();
        expect(header).toContain("HttpOnly");
        expect(header).toContain("SameSite=Lax");
        expect(header).toContain("Path=/");
        expect(header).toContain("Max-Age=");
      }
    });

    it("register issues a working token pair", async () => {
      const res = await request(app)
        .post("/api/users/register")
        .send(registerInput);

      expect(res.status).toBe(201);
      const access = cookieValue(res.headers["set-cookie"], "theatre.jwt");
      expect(access).toBeDefined();

      const me = await authedRequest(access!, "theatre.jwt");
      expect(me.status).toBe(200);
      expect(me.body).toMatchObject({ username: "movielover" });
    });

    it("stores the refresh token hashed, never in plain text", async () => {
      const { refresh } = await login();

      const user = await getUserByEmail(registerInput.email);
      const row = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.userId, user!.id));

      expect(row).toHaveLength(1);
      expect(row[0]!.tokenHash).not.toBe(refresh);
      expect(row[0]!.tokenHash).toBe(hashToken(refresh));
      expect(row[0]!.revoked).toBe(false);
    });
  });

  describe("authentication", () => {
    it("the access cookie authenticates /me", async () => {
      const { access } = await login();

      const res = await authedRequest(access, "theatre.jwt");

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        username: "movielover",
        email: "movielover@example.com",
      });
      expect(res.body).not.toHaveProperty("passwordHash");
    });

    it("a Bearer access token authenticates /me", async () => {
      const { access } = await login();

      const res = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${access}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ username: "movielover" });
    });

    it("a refresh token cannot act as an access token", async () => {
      const { refresh } = await login();

      const asCookie = await authedRequest(refresh, "theatre.jwt");
      expect(asCookie.status).toBe(401);

      const asBearer = await request(app)
        .get("/api/users/me")
        .set("Authorization", `Bearer ${refresh}`);
      expect(asBearer.status).toBe(401);
    });

    it("tampering with the access token signature is rejected", async () => {
      const { access } = await login();
      const forged = `${access.slice(0, -2)}xx`;

      const res = await authedRequest(forged, "theatre.jwt");

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Authentication required" });
    });

    it("a deleted user's tokens stop working", async () => {
      const { access, refresh } = await login();

      const user = await getUserByEmail(registerInput.email);
      await deleteUser(user!.id);

      const me = await authedRequest(access, "theatre.jwt");
      expect(me.status).toBe(401);

      // The refresh row cascades away with the user.
      const refreshed = await refreshWith(refresh);
      expect(refreshed.status).toBe(401);
    });
  });

  describe("refresh rotation", () => {
    it("refresh returns a new pair and kills the old refresh token", async () => {
      const { access, refresh } = await login();

      const res = await refreshWith(refresh);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ message: "Token refreshed" });

      const newAccess = cookieValue(res.headers["set-cookie"], "theatre.jwt");
      const newRefresh = cookieValue(
        res.headers["set-cookie"],
        "theatre.refresh",
      );
      expect(newAccess).toBeDefined();
      expect(newRefresh).toBeDefined();
      expect(newAccess).not.toBe(access);
      expect(newRefresh).not.toBe(refresh);

      // The new pair authenticates; the old refresh token is dead.
      const me = await authedRequest(newAccess!, "theatre.jwt");
      expect(me.status).toBe(200);

      const replay = await refreshWith(refresh);
      expect(replay.status).toBe(401);

      // The new refresh token works and keeps the single active row.
      const again = await refreshWith(newRefresh!);
      expect(again.status).toBe(200);
      const user = await getUserByEmail(registerInput.email);
      const rows = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.userId, user!.id));
      expect(rows).toHaveLength(1);
    });

    it("refresh without a cookie returns 401", async () => {
      const res = await refreshWith(undefined);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Refresh token required" });
    });

    it("refresh with a garbage token returns 401", async () => {
      const res = await refreshWith("not-a-jwt");

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Invalid or expired token" });
    });

    it("an access token cannot act as a refresh token", async () => {
      const { access } = await login();

      const res = await refreshWith(access);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ message: "Invalid or expired token" });
    });

    it("a revoked refresh token is rejected", async () => {
      const { refresh } = await login();

      const user = await getUserByEmail(registerInput.email);
      await db
        .update(refreshTokens)
        .set({ revoked: true })
        .where(eq(refreshTokens.userId, user!.id));

      const res = await refreshWith(refresh);

      expect(res.status).toBe(401);
    });

    it("an expired refresh token is rejected", async () => {
      const { refresh } = await login();

      const user = await getUserByEmail(registerInput.email);
      await db
        .update(refreshTokens)
        .set({ expiresAt: new Date(Date.now() - 1000) })
        .where(eq(refreshTokens.userId, user!.id));

      const res = await refreshWith(refresh);

      expect(res.status).toBe(401);
    });
  });

  describe("logout", () => {
    it("logout revokes the refresh token and clears both cookies", async () => {
      const { refresh } = await login();

      // Logout requires authentication: replay the full pair through an
      // agent so both cookies ride along.
      const agent = request.agent(app);
      await agent.post("/api/users/register").send(registerInput);
      const loginRes = await agent.post("/api/users/login").send({
        username: registerInput.username,
        password: registerInput.password,
      });
      expect(loginRes.status).toBe(200);

      const logout = await agent.post("/api/users/logout");
      expect(logout.status).toBe(200);
      expect(logout.body).toEqual({ message: "Logged out" });

      const cleared = (
        logout.headers["set-cookie"] as unknown as string[]
      ).join(" ");
      expect(cleared).toContain("theatre.jwt=;");
      expect(cleared).toContain("theatre.refresh=;");
      expect(cleared).toContain("Expires=Thu, 01 Jan 1970");

      // The pre-logout refresh token is revoked server-side.
      const user = await getUserByEmail(registerInput.email);
      const row = await db
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.userId, user!.id));
      expect(row[0]!.revoked).toBe(true);

      expect((await refreshWith(refresh)).status).toBe(401);
      // The agent lost its cookies: further authenticated calls fail.
      expect((await agent.post("/api/users/logout")).status).toBe(401);
    });
  });
});
