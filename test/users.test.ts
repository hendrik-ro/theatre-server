import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/server.js";
import { db } from "../src/db/index.js";
import { sessions } from "../src/db/schema/sessions.sql.js";
import {
  deleteUser,
  getUserByEmail,
  resetUsers,
} from "../src/db/queries/users.js";
import { sessionStore } from "../src/db/sessionStore.js";

const registerInput = {
  username: "movielover",
  email: "movielover@example.com",
  password: "testpassword1000",
};

async function registerUser() {
  const res = await request(app)
    .post("/api/users/register")
    .send(registerInput);
  expect(res.status).toBe(201);
}

function sidFromSetCookie(setCookie: unknown): string {
  const header = Array.isArray(setCookie) ? setCookie[0] : String(setCookie);
  // express-session signs the cookie value: "s:<sid>.<signature>"
  const value = decodeURIComponent(header.split("=")[1]!.split(";")[0]!);
  return value.slice("s:".length).split(".")[0]!;
}

function storeGet(sid: string) {
  return new Promise((resolve, reject) =>
    sessionStore.get(sid, (err, sessionData) =>
      err ? reject(err) : resolve(sessionData),
    ),
  );
}

describe("users", () => {
  beforeEach(async () => {
    await resetUsers();
    await db.delete(sessions);
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
    expect(me.body).toMatchObject({ username: "movielover", role: "user" });

    const user = await getUserByEmail(registerInput.email);
    expect(user!.lastLoginAt).not.toBeNull();
  });

  it("login with an unknown email returns 401 invalid credentials", async () => {
    const res = await request(app)
      .post("/api/users/login")
      .send({ email: "unknown@example.com", password: "testpassword1000" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Invalid credentials" });
  });

  it("login with a wrong password returns 401 invalid credentials", async () => {
    await registerUser();

    const res = await request(app)
      .post("/api/users/login")
      .send({ email: registerInput.email, password: "wrongpassword99" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Invalid credentials" });
  });

  it("login with a too-short password returns 400", async () => {
    const res = await request(app)
      .post("/api/users/login")
      .send({ email: registerInput.email, password: "short" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: expect.any(String) });
  });

  it("login issues a session cookie bound to the user", async () => {
    await registerUser();

    const res = await request(app)
      .post("/api/users/login")
      .send({ email: registerInput.email, password: registerInput.password });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ username: "movielover" });

    const setCookie = res.headers["set-cookie"]!;
    const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    expect(cookie).toContain("theatre.sid=");
    expect(cookie).toContain("HttpOnly");

    const sid = sidFromSetCookie(setCookie);
    const sessionData = (await storeGet(sid)) as { userId?: string };
    const user = await getUserByEmail(registerInput.email);
    expect(sessionData.userId).toBe(user!.id);
    expect(user!.lastLoginAt).not.toBeNull();
  });

  it("GET /api/users/me without a session returns 401", async () => {
    const res = await request(app).get("/api/users/me");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Authentication required" });
  });

  it("GET /api/users/me returns the logged-in user without sensitive fields", async () => {
    const agent = request.agent(app);
    await registerUser();
    const login = await agent
      .post("/api/users/login")
      .send({ email: registerInput.email, password: registerInput.password });
    expect(login.status).toBe(200);

    const res = await agent.get("/api/users/me");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      username: "movielover",
      email: "movielover@example.com",
      role: "user",
    });
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("register with a duplicate username returns 409", async () => {
    await registerUser();

    const res = await request(app).post("/api/users/register").send({
      username: "movielover",
      email: "other@example.com",
      password: "testpassword1000",
    });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: "This username is already taken" });
  });

  it("register with a duplicate email returns 409", async () => {
    await registerUser();

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

  it("logout destroys the session and clears the cookie", async () => {
    const agent = request.agent(app);
    await registerUser();

    const login = await agent
      .post("/api/users/login")
      .send({ email: registerInput.email, password: registerInput.password });
    expect(login.status).toBe(200);
    const sid = sidFromSetCookie(login.headers["set-cookie"]);

    const res = await agent.post("/api/users/logout");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Logged out" });
    const cleared = res.headers["set-cookie"]!.join(" ");
    expect(cleared).toContain("theatre.sid=");
    expect(cleared).toContain("Expires=Thu, 01 Jan 1970");

    expect(await storeGet(sid)).toBeNull();
    const after = await agent.post("/api/users/logout");
    expect(after.status).toBe(401);
  });

  it("logout without a session returns 401", async () => {
    const res = await request(app).post("/api/users/logout");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Authentication required" });
  });

  it("rejects a session whose user was deleted", async () => {
    const agent = request.agent(app);
    await registerUser();

    const login = await agent
      .post("/api/users/login")
      .send({ email: registerInput.email, password: registerInput.password });
    expect(login.status).toBe(200);

    const user = await getUserByEmail(registerInput.email);
    await deleteUser(user!.id);

    const res = await agent.post("/api/users/logout");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Authentication required" });
  });
});
