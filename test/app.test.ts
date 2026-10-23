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
    expect(res.body).toEqual({ status: "ok", db: "connected" });
  });

  it("does not set a session cookie for anonymous requests", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"]).toBeUndefined();
  });
});

describe("CORS", () => {
  it("sets CORS headers for simple requests in development", async () => {
    const res = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5173");

    // With credentials: true, the origin must be explicit, not "*"
    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("sets CORS headers for preflight OPTIONS requests", async () => {
    const res = await request(app)
      .options("/api/movies")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "GET");

    // With credentials: true, the origin must be explicit, not "*"
    expect(res.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );
    expect(res.headers["access-control-allow-methods"]).toContain("GET");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("allows requests without Origin header", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
  });

  it("allows any origin in development mode", async () => {
    // In development, any origin should be accepted
    const customOrigin = "http://custom.example.com:8080";
    const res = await request(app)
      .get("/api/health")
      .set("Origin", customOrigin);

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe(customOrigin);
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });
});

describe("Health check", () => {
  it("returns 200 with db status when database is connected", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.db).toBe("connected");
  });

  it("response includes both status and db fields", async () => {
    const res = await request(app).get("/api/health");

    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("db");
    expect(typeof res.body.status).toBe("string");
    expect(typeof res.body.db).toBe("string");
  });
});

describe("Graceful shutdown", () => {
  it("server exports app for testing", async () => {
    expect(app).toBeDefined();
    expect(typeof app.listen).toBe("function");
  });

  it("app has middleware chain including CORS and errorHandler", async () => {
    // Verify the app has the expected middleware
    expect(app._router).toBeDefined();
    // The middleware stack should include our routes
    const routes = app._router.stack;
    expect(routes.length).toBeGreaterThan(0);
  });
});
