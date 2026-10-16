import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/server.js";
import { db } from "../src/db/index.js";
import { sessions } from "../src/db/schema/sessions.sql.js";
import {
  changeRole,
  getUserByEmail,
  resetUsers,
} from "../src/db/queries/users.js";
import { createMovie, resetMovies } from "../src/db/queries/movies.js";

const adminInput = {
  username: "theatreboss",
  email: "boss@example.com",
  password: "testpassword1000",
};

const regularInput = {
  username: "regularjoe",
  email: "regular@example.com",
  password: "testpassword1000",
};

type RegisterInput = typeof adminInput;

// Registers the user, optionally promotes them, and returns a supertest
// agent with a logged-in session.
async function registerAndLogin(
  input: RegisterInput,
  role: "user" | "admin" = "user",
) {
  const res = await request(app).post("/api/users/register").send(input);
  expect(res.status).toBe(201);
  if (role === "admin") {
    const user = await getUserByEmail(input.email);
    await changeRole(user!.id, "admin");
  }
  const agent = request.agent(app);
  const login = await agent
    .post("/api/users/login")
    .send({ username: input.username, password: input.password });
  expect(login.status).toBe(200);
  return agent;
}

describe("admin routes", () => {
  beforeEach(async () => {
    await resetUsers();
    await resetMovies();
    await db.delete(sessions);
  });

  it("GET /api/admin/users without a session returns 401", async () => {
    const res = await request(app).get("/api/admin/users");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Authentication required" });
  });

  it("GET /api/admin/users as a non-admin returns 403", async () => {
    const admin = await registerAndLogin(adminInput);
    const agent = await registerAndLogin(regularInput);

    const adminRes = await admin.get("/api/admin/users");

    expect(adminRes.status).toBe(200);

    const res = await agent.get("/api/admin/users");

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Admin access required" });
  });

  it("GET /api/admin/users as an admin returns users without hashes", async () => {
    const agent = await registerAndLogin(adminInput, "admin");

    const res = await agent.get("/api/admin/users");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ username: adminInput.username });
    expect(res.body[0]).not.toHaveProperty("passwordHash");
  });

  it("DELETE /api/admin/users/:id as an admin removes the targeted user", async () => {
    const agent = await registerAndLogin(adminInput, "admin");
    await request(app).post("/api/users/register").send(regularInput);
    const target = await getUserByEmail(regularInput.email);

    const res = await agent.delete(`/api/admin/users/${target!.id}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(await getUserByEmail(regularInput.email)).toBeUndefined();
  });

  it("DELETE /api/admin/users/:id with an invalid UUID returns 400", async () => {
    const agent = await registerAndLogin(adminInput, "admin");

    const res = await agent.delete("/api/admin/users/not-a-uuid");

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Invalid UUID" });
  });

  it("DELETE /api/admin/users/:id by a non-admin returns 403 and keeps the user", async () => {
    await registerAndLogin(adminInput);
    const agent = await registerAndLogin(regularInput);
    await request(app).post("/api/users/register").send(adminInput);
    const target = await getUserByEmail(adminInput.email);

    const res = await agent.delete(`/api/admin/users/${target!.id}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Admin access required" });
    expect(await getUserByEmail(adminInput.email)).toBeDefined();
  });

  it("an admin deleting their own account invalidates their session", async () => {
    const agent = await registerAndLogin(adminInput, "admin");
    const self = await getUserByEmail(adminInput.email);

    const res = await agent.delete(`/api/admin/users/${self!.id}`);
    expect(res.status).toBe(204);

    const after = await agent.post("/api/users/logout");
    expect(after.status).toBe(401);
    expect(after.body).toEqual({ message: "Authentication required" });
  });

  it("DELETE /api/admin/movies/:id by a non-admin returns 403", async () => {
    await registerAndLogin(adminInput);
    const agent = await registerAndLogin(regularInput);
    const movie = await createMovie("Admin Test Movie");

    const res = await agent.delete(`/api/admin/movies/${movie.id}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Admin access required" });
  });

  it("DELETE /api/admin/movies/:id as an admin deletes the movie", async () => {
    const agent = await registerAndLogin(adminInput, "admin");
    const movie = await createMovie("Admin Test Movie");

    const res = await agent.delete(`/api/admin/movies/${movie.id}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    const gone = await request(app).get(`/api/movies/${movie.id}`);
    expect(gone.status).toBe(404);
  });
});

describe("self-service deletion", () => {
  beforeEach(async () => {
    await resetUsers();
    await resetMovies();
    await db.delete(sessions);
  });

  it("DELETE /api/users/:id lets a non-admin delete their own account", async () => {
    const agent = await registerAndLogin(regularInput);
    const self = await getUserByEmail(regularInput.email);

    const res = await agent.delete(`/api/users/${self!.id}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(await getUserByEmail(regularInput.email)).toBeUndefined();

    const after = await agent.post("/api/users/logout");
    expect(after.status).toBe(401);
    expect(after.body).toEqual({ message: "Authentication required" });
  });

  it("DELETE /api/users/:id by a non-admin targeting someone else returns 403", async () => {
    await registerAndLogin(adminInput);
    const agent = await registerAndLogin(regularInput);
    await request(app).post("/api/users/register").send(adminInput);
    const target = await getUserByEmail(adminInput.email);

    const res = await agent.delete(`/api/users/${target!.id}`);

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ message: "Admin access required" });
    expect(await getUserByEmail(adminInput.email)).toBeDefined();
  });

  it("DELETE /api/users/:id without a session returns 401", async () => {
    const res = await request(app).delete("/api/users/not-a-uuid");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Authentication required" });
  });
});
