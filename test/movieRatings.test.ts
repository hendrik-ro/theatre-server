import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { registerInput, resetDB } from "./helpers.js";
import { app } from "../src/server.js";
import { createMovie } from "../src/db/queries/movies.js";
import { getUserByUsername } from "../src/db/queries/users.js";

async function addTestMovie() {
  return await createMovie({
    name: "The Matrix",
    year: 1999,
    runtime: 136,
    imdbRating: 8.7,
    genre: "sci-fi",
  });
}

beforeEach(async () => {
  await resetDB();
});

describe("movieRatings", () => {
  it("creates a new movie rating", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);
    const movie = await addTestMovie();

    const res = await agent
      .post(`/api/ratings/${movie.id}`)
      .send({ rating: 9 });
    expect(res.status).toBe(201);
  });

  it("returns 401 for unauthenticated user", async () => {
    const agent = request.agent(app);
    const movie = await addTestMovie();

    const res = await agent.post(`/api/ratings/${movie.id}`);
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ message: "Authentication required" });
  });

  it("POST returns 400 for malformed uuid", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);

    const res = await agent.post("/api/ratings/not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("DELETE returns 400 for malformed uuid", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);

    const res = await agent.delete("/api/ratings/not-a-uuid");
    expect(res.status).toBe(400);
  });

  it("DELETE is idempotent", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);
    const movie = await addTestMovie();

    const rating = await agent
      .post(`/api/ratings/${movie.id}`)
      .send({ rating: 9 });
    expect(rating.status).toBe(201);

    const firstDelete = await agent.delete(`/api/ratings/${movie.id}`);
    expect(firstDelete.status).toBe(204);
    const secondDelete = await agent.delete(`/api/ratings/${movie.id}`);
    expect(secondDelete.status).toBe(204);

    const get = await agent.get(`/api/ratings/${movie.id}`);
    expect(get.status).toBe(404);
  });

  it("POST overrides rating", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);
    const movie = await addTestMovie();

    const firstRating = await agent
      .post(`/api/ratings/${movie.id}`)
      .send({ rating: 9 });
    expect(firstRating.status).toBe(201);
    expect(firstRating.body.rating).toBe(9);
    const secondRating = await agent
      .post(`/api/ratings/${movie.id}`)
      .send({ rating: 8 });
    expect(secondRating.status).toBe(201);
    expect(secondRating.body.rating).toBe(8);
    // The upsert updates the existing row; it must not delete and
    // reinsert, which would give the rating a new createdAt.
    expect(secondRating.body.createdAt).toBe(firstRating.body.createdAt);
  });

  it("GET returns a matching rating", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);
    const movie = await addTestMovie();
    const user = await getUserByUsername(registerInput.username);

    await agent.post(`/api/ratings/${movie.id}`).send({ rating: 9 });
    const rating = await agent.get(`/api/ratings/${movie.id}`);
    expect(rating.status).toBe(200);
    expect(rating.body.rating).toBe(9);
    expect(rating.body.movieId).toBe(movie.id);
    expect(user).toBeDefined();
    expect(rating.body.userId).toBe(user!.id);
  });

  it("DELETE leaves other ratings untouched", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);
    const movie = await addTestMovie();
    const secondMovie = await createMovie({
      name: "Inception",
    });

    const rating = await agent
      .post(`/api/ratings/${movie.id}`)
      .send({ rating: 9 });
    expect(rating.status).toBe(201);
    const secondRating = await agent
      .post(`/api/ratings/${secondMovie.id}`)
      .send({ rating: 8 });
    expect(secondRating.status).toBe(201);
    const deletion = await agent.delete(`/api/ratings/${movie.id}`);
    expect(deletion.status).toBe(204);

    const validatedSecondRating = await agent.get(
      `/api/ratings/${secondMovie.id}`,
    );
    expect(validatedSecondRating.body.movieId).toBe(secondMovie.id);
  });

  it("rejects out-of-range and non-integer ratings", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);
    const movie = await addTestMovie();

    const invalidRatings = [
      11,
      -1,
      2.5,
      "nine",
      undefined, // missing rating key
    ];
    for (const rating of invalidRatings) {
      const res = await agent
        .post(`/api/ratings/${movie.id}`)
        .send(rating === undefined ? {} : { rating });
      expect(res.status, `rating: ${String(rating)}`).toBe(400);
    }
  });

  it("POST returns 404 for an unknown movie", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);

    const res = await agent
      .post("/api/ratings/00000000-0000-0000-0000-000000000000")
      .send({ rating: 9 });
    expect(res.status).toBe(404);
  });

  it("GET returns 404 for an unrated movie", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);
    const movie = await addTestMovie();

    const res = await agent.get(`/api/ratings/${movie.id}`);
    expect(res.status).toBe(404);
  });

  it("isolates ratings between users", async () => {
    const alice = request.agent(app);
    await alice.post("/api/users/register").send(registerInput);
    const bob = request.agent(app);
    await bob.post("/api/users/register").send({
      username: "cinephile",
      email: "cinephile@example.com",
      password: "testpassword2000",
    });
    const movie = await addTestMovie();

    const aliceRating = await alice
      .post(`/api/ratings/${movie.id}`)
      .send({ rating: 9 });
    expect(aliceRating.status).toBe(201);
    const bobRating = await bob
      .post(`/api/ratings/${movie.id}`)
      .send({ rating: 5 });
    expect(bobRating.status).toBe(201);

    const aliceGet = await alice.get(`/api/ratings/${movie.id}`);
    expect(aliceGet.status).toBe(200);
    expect(aliceGet.body.rating).toBe(9);
    const bobGet = await bob.get(`/api/ratings/${movie.id}`);
    expect(bobGet.status).toBe(200);
    expect(bobGet.body.rating).toBe(5);

    const deletion = await alice.delete(`/api/ratings/${movie.id}`);
    expect(deletion.status).toBe(204);

    const bobGetAfterDelete = await bob.get(`/api/ratings/${movie.id}`);
    expect(bobGetAfterDelete.status).toBe(200);
    expect(bobGetAfterDelete.body.rating).toBe(5);
  });
});
