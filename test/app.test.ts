import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/server.js";

describe("app", () => {
  it("responds with JSON 404 for unknown /api routes", async () => {
    const res = await request(app).get("/api/unknown");

    expect(res.status).toBe(404);
    expect(res.type).toBe("application/json");
    expect(res.body).toEqual({ message: "Not found" });
  });

  it("responds with JSON 404 for unknown methods on known paths", async () => {
    const res = await request(app).delete("/api/movies");

    expect(res.status).toBe(404);
    expect(res.type).toBe("application/json");
  });

  it("responds with 413 for a body above the 16kb limit", async () => {
    const res = await request(app)
      .post("/api/movies")
      .send({ name: "x".repeat(17 * 1024) });

    expect(res.status).toBe(413);
    expect(res.body).toEqual({ message: "Payload too large" });
  });

  it("responds with 400 for a malformed JSON body", async () => {
    const res = await request(app)
      .post("/api/movies")
      .set("Content-Type", "application/json")
      .send('{"name": "broken');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Invalid JSON body" });
  });

  it("responds ok on the health endpoint", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("does not set a session cookie for anonymous requests", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });
});
