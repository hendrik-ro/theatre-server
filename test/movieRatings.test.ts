import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { registerInput, resetDB } from "./helpers";
import { app } from "../src/server";
import { createMovie } from "../src/db/queries/movies";
import { getUserByUsername } from "../src/db/queries/users";

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

    const res = await agent.delete(`/api/ratings/${movie.id}`);
    expect(res.status).toBe(204);
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
  });

  it("GET returns a matching rating", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);
    const movie = await addTestMovie();
    const user = await getUserByUsername(registerInput.username);

    const rating = await agent
      .post(`/api/ratings/${movie.id}`)
      .send({ rating: 9 });
    expect(rating.status).toBe(201);
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
});
