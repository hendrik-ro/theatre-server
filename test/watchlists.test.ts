import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/server.js";
import { createMovie } from "../src/db/queries/movies.js";
import { registerInput, resetDB } from "./helpers.js";

beforeEach(async () => {
  await resetDB();
});

describe("watchlists", () => {
  it("returns 401 for unauthenticated user", async () => {
    const agent = request.agent(app);
    const movie = await createMovie({ name: "Inception" });

    const res = await agent.post(`/api/watchlists/${movie.id}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Authentication required" });
  });

  it("POST returns 400 for malformed uuid", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);

    const res = await agent.post("/api/watchlists/not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("DELETE returns 400 for malformed uuid", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);

    const res = await agent.delete("/api/watchlists/not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("duplicates returns 409", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);
    const movie = await createMovie({ name: "Inception" });

    await agent.post(`/api/watchlists/${movie.id}`);
    const res = await agent.post(`/api/watchlists/${movie.id}`);
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: "Movie already in watchlist" });
  });

  it("DELETE is idempotent", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);
    const movie = await createMovie({ name: "Inception" });

    const res = await agent.delete(`/api/watchlists/${movie.id}`);
    expect(res.status).toBe(204);
  });

  it("POST /api/watchlists/:movieId adds a movie to the user's watchlist", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);
    const movie = await createMovie({ name: "Inception" });

    const res = await agent.post(`/api/watchlists/${movie.id}`);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: "Movie added to watchlist" });

    const list = await agent.get("/api/watchlists");
    expect(list.body).toEqual([expect.objectContaining({ id: movie.id })]);
  });

  it("GET /api/watchlists returns a list of movies", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);
    const movie = await createMovie({ name: "Inception" });
    const otherMovie = await createMovie({ name: "The Matrix" });

    await agent.post(`/api/watchlists/${movie.id}`);
    await agent.post(`/api/watchlists/${otherMovie.id}`);

    const list = await agent.get("/api/watchlists");
    expect(list.body).toHaveLength(2);
  });

  it("DELETE /api/watchlists/:movieId removes a movie from the user's watchlist", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);
    const movie = await createMovie({ name: "Inception" });
    await agent.post(`/api/watchlists/${movie.id}`);

    const res = await agent.delete(`/api/watchlists/${movie.id}`);
    expect(res.status).toBe(204);

    const list = await agent.get("/api/watchlists");
    expect(list.body).toEqual([]);
  });

  it("DELETE /api/watchlists/:movieId leaves other movies untouched", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);
    const movie = await createMovie({ name: "Inception" });
    const otherMovie = await createMovie({ name: "The Matrix" });
    await agent.post(`/api/watchlists/${movie.id}`);
    await agent.post(`/api/watchlists/${otherMovie.id}`);

    const res = await agent.delete(`/api/watchlists/${movie.id}`);
    expect(res.status).toBe(204);

    const list = await agent.get("/api/watchlists");
    expect(list.body).toEqual([expect.objectContaining({ id: otherMovie.id })]);
  });

  it("GET /api/watchlists isolates from other users", async () => {
    const agent = request.agent(app);
    const movie = await createMovie({ name: "Inception" });
    const otherMovie = await createMovie({ name: "The Matrix" });
    const userOne = await agent.post("/api/users/register").send(registerInput);
    expect(userOne.status).toBe(201);
    await agent.post(`/api/watchlists/${movie.id}`);
    const userTwo = await agent.post("/api/users/register").send({
      username: "anotherUser",
      password: "testtesttest",
      email: "tester2000@test.com",
    });
    expect(userTwo.status).toBe(201);
    await agent.post(`/api/watchlists/${otherMovie.id}`);

    const list = await agent.get("/api/watchlists");
    expect(list.body).toEqual([expect.not.objectContaining({ id: movie.id })]);
    expect(list.body).toEqual([expect.objectContaining({ id: otherMovie.id })]);
  });
});
