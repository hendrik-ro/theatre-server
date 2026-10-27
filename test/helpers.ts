import request from "supertest";
import type { Express } from "express";
import { expect } from "vitest";
import { getTableName, sql } from "drizzle-orm";
import { db, schema } from "../src/db/index.js";
import { createMovie } from "../src/db/queries/movies.js";
import type { MovieInput } from "../src/models/movies.js";

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

// supertest types set-cookie as a single string; at runtime it is an
// array when multiple Set-Cookie headers are sent.
export function setCookieHeaders(res: request.Response): string[] {
  const headers = res.headers["set-cookie"] as unknown;
  return Array.isArray(headers) ? (headers as string[]) : [String(headers)];
}

// Registers the default user — the shared precondition of most auth
// tests — asserting the 201 so callers can rely on it having worked.
export async function registerUser(app: Express): Promise<void> {
  const res = await request(app)
    .post("/api/users/register")
    .send(registerInput);
  expect(res.status).toBe(201);
}

// Registers the given user and returns a supertest agent carrying the
// logged-in user's JWT cookies — the shared precondition of the
// authenticated integration suites.
export async function authenticatedAgent(
  app: Express,
  input: typeof registerInput = registerInput,
): Promise<request.Agent> {
  const agent = request.agent(app);
  const res = await agent.post("/api/users/register").send(input);
  expect(res.status).toBe(201);
  return agent;
}

const defaultMovieInput: MovieInput = {
  name: "Inception",
  year: 2010,
  runtime: 148,
  genre: "sci-fi",
};

// Creates a movie with full defaults; pass overrides for the one or two
// fields the test actually cares about (usually just the name).
export async function createTestMovie(overrides: Partial<MovieInput> = {}) {
  return createMovie({ ...defaultMovieInput, ...overrides });
}

export async function resetDB(): Promise<void> {
  // Truncates every table registered in the drizzle schema map — the
  // list is derived, so a new table is picked up automatically. It
  // includes app_bootstrap: each test then starts from an empty
  // first-admin claim, which makes the first registration's admin
  // role deterministic instead of order-dependent.
  const tables = Object.values(schema);
  await db.execute(
    sql`TRUNCATE TABLE ${sql.join(
      tables.map((t) => sql.identifier(getTableName(t))),
      sql`, `,
    )}`,
  );
}
