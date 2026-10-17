import request from "supertest";
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

describe("users", () => {
  beforeEach(async () => {
    await resetUsers();
  });

  it("register creates a user", async () => {
    const res = await request(app)
      .post("/api/users/register")
      .send(registerInput);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: "User movielover created" });
  });

  it("register logs the new user in", async () => {
    const agent = request.agent(app);

    const res = await agent.post("/api/users/register").send(registerInput);
    expect(res.status).toBe(201);
    expect(res.headers["set-cookie"]).toBeDefined();

    const me = await agent.get("/api/users/me");
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ username: "movielover", role: "admin" });

    const user = await getUserByEmail(registerInput.email);
    expect(user!.lastLoginAt).not.toBeNull();
  });

  it("login with an unknown username returns 401 invalid credentials", async () => {
    const res = await request(app)
      .post("/api/users/login")
      .send({ username: "unknown", password: "testpassword1000" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Invalid credentials" });
  });

  it("login with a wrong password returns 401 invalid credentials", async () => {
    await registerUser(app);

    const res = await request(app)
      .post("/api/users/login")
      .send({ username: registerInput.username, password: "wrongpassword99" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Invalid credentials" });
  });

  it("login with a too-short password returns 400", async () => {
    const res = await request(app)
      .post("/api/users/login")
      .send({ username: registerInput.username, password: "short" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: expect.any(String) });
  });

  it("login issues JWT cookies bound to the user", async () => {
    await registerUser(app);

    const res = await request(app).post("/api/users/login").send({
      username: registerInput.username,
      password: registerInput.password,
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ username: "movielover" });

    const headers = (res.headers["set-cookie"] as unknown as string[]) ?? [
      res.headers["set-cookie"],
    ];
    const accessCookie = headers.find((h) => h.startsWith("theatre.jwt="));
    const refreshCookie = headers.find((h) => h.startsWith("theatre.refresh="));
    expect(accessCookie).toContain("HttpOnly");
    expect(refreshCookie).toContain("HttpOnly");

    // The refresh cookie's token matches the hashed row bound to the user.
    const refreshValue = cookieValue(headers, "theatre.refresh");
    const user = await getUserByEmail(registerInput.email);
    const rows = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, user!.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.tokenHash).toBe(hashToken(refreshValue!));
    expect(rows[0]!.revoked).toBe(false);
    expect(user!.lastLoginAt).not.toBeNull();
  });

  it("GET /api/users/me without authentication returns 401", async () => {
    const res = await request(app).get("/api/users/me");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Authentication required" });
  });

  it("GET /api/users/me returns the logged-in user without sensitive fields", async () => {
    const agent = request.agent(app);
    await registerUser(app);
    const login = await agent.post("/api/users/login").send({
      username: registerInput.username,
      password: registerInput.password,
    });
    expect(login.status).toBe(200);

    const res = await agent.get("/api/users/me");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      username: "movielover",
      email: "movielover@example.com",
      role: "admin",
    });
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("register with a duplicate username returns 409", async () => {
    await registerUser(app);

    const res = await request(app).post("/api/users/register").send({
      username: "movielover",
      email: "other@example.com",
      password: "testpassword1000",
    });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: "This username is already taken" });
  });

  it("register with a duplicate email returns 409", async () => {
    await registerUser(app);

    const res = await request(app).post("/api/users/register").send({
      username: "cinephile",
      email: "movielover@example.com",
      password: "testpassword1000",
    });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      message: "An account with this email already exists",
    });
  });

  it("logout revokes the refresh token and clears the cookies", async () => {
    const agent = request.agent(app);
    await registerUser(app);

    const login = await agent.post("/api/users/login").send({
      username: registerInput.username,
      password: registerInput.password,
    });
    expect(login.status).toBe(200);

    const res = await agent.post("/api/users/logout");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Logged out" });
    // supertest types set-cookie as a single string; at runtime it is an
    // array when multiple Set-Cookie headers are sent.
    const cleared = (res.headers["set-cookie"] as unknown as string[]).join(
      " ",
    );
    expect(cleared).toContain("theatre.jwt=");
    expect(cleared).toContain("theatre.refresh=");
    expect(cleared).toContain("Expires=Thu, 01 Jan 1970");

    // The refresh row is revoked server-side.
    const user = await getUserByEmail(registerInput.email);
    const rows = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.userId, user!.id));
    expect(rows[0]!.revoked).toBe(true);

    // The agent lost its cookies: further authenticated calls fail.
    const after = await agent.post("/api/users/logout");
    expect(after.status).toBe(401);
  });

  it("logout without authentication returns 401", async () => {
    const res = await request(app).post("/api/users/logout");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Authentication required" });
  });

  it("rejects a token whose user was deleted", async () => {
    const agent = request.agent(app);
    await registerUser(app);

    const login = await agent.post("/api/users/login").send({
      username: registerInput.username,
      password: registerInput.password,
    });
    expect(login.status).toBe(200);

    const user = await getUserByEmail(registerInput.email);
    await deleteUser(user!.id);

    const res = await agent.post("/api/users/logout");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Authentication required" });
  });
});
