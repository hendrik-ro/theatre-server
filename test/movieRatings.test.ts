import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { registerInput, resetDB } from "./helpers.js";
import { app } from "../src/server.js";
import { createMovie } from "../src/db/queries/movies.js";
import { getUserByUsername } from "../src/db/queries/users.js";
import { UserMovieRating } from "../src/models/ratings.js";

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

  it("GET '/api/ratings' returns all ratings for logged in user", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);
    const movie = await addTestMovie();
    const movie2 = await createMovie({ name: "Inception" });
    const movie3 = await createMovie({ name: "The Godfather", year: 1975 });

    const noRatings = await agent.get("/api/ratings");
    expect(noRatings.body).toHaveLength(0);

    const rating = await agent
      .post(`/api/ratings/${movie.id}`)
      .send({ rating: 9 });
    expect(rating.status).toBe(201);
    const rating2 = await agent
      .post(`/api/ratings/${movie2.id}`)
      .send({ rating: 8 });
    expect(rating2.status).toBe(201);
    const rating3 = await agent
      .post(`/api/ratings/${movie3.id}`)
      .send({ rating: 7 });
    expect(rating3.status).toBe(201);

    const allRatings = await agent.get("/api/ratings");
    expect(allRatings.body).toHaveLength(3);
  });

  it("GET '/api/ratings' returns correct rating values and movie IDs", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);
    const movie1 = await addTestMovie();
    const movie2 = await createMovie({ name: "Inception" });
    const movie3 = await createMovie({ name: "The Godfather", year: 1975 });

    await agent.post(`/api/ratings/${movie1.id}`).send({ rating: 9 });
    await agent.post(`/api/ratings/${movie2.id}`).send({ rating: 8 });
    await agent.post(`/api/ratings/${movie3.id}`).send({ rating: 7 });

    const allRatings = await agent.get("/api/ratings");
    expect(allRatings.body).toHaveLength(3);

    const ratings = allRatings.body as UserMovieRating[];
    const ratingsByMovieId = new Map(ratings.map((r) => [r.movieId, r]));

    expect(ratingsByMovieId.get(movie1.id)?.rating).toBe(9);
    expect(ratingsByMovieId.get(movie2.id)?.rating).toBe(8);
    expect(ratingsByMovieId.get(movie3.id)?.rating).toBe(7);
  });

  it("GET '/api/ratings' isolates ratings between users", async () => {
    const alice = request.agent(app);
    await alice.post("/api/users/register").send(registerInput);
    const bob = request.agent(app);
    await bob.post("/api/users/register").send({
      username: "cinephile",
      email: "cinephile@example.com",
      password: "testpassword2000",
    });
    const movie1 = await addTestMovie();
    const movie2 = await createMovie({ name: "Inception" });

    await alice.post(`/api/ratings/${movie1.id}`).send({ rating: 9 });
    await alice.post(`/api/ratings/${movie2.id}`).send({ rating: 8 });
    await bob.post(`/api/ratings/${movie1.id}`).send({ rating: 5 });

    const aliceRatings = await alice.get("/api/ratings");
    expect(aliceRatings.body).toHaveLength(2);
    const aliceRatingsTyped = aliceRatings.body as UserMovieRating[];
    expect(
      aliceRatingsTyped.every((r) => r.userId === aliceRatingsTyped[0].userId),
    ).toBe(true);

    const bobRatings = await bob.get("/api/ratings");
    expect(bobRatings.body).toHaveLength(1);
    const bobRatingsTyped = bobRatings.body as UserMovieRating[];
    expect(bobRatingsTyped[0].rating).toBe(5);
  });

  it("GET '/api/ratings' returns ratings sorted by movieId", async () => {
    const agent = request.agent(app);
    await agent.post("/api/users/register").send(registerInput);
    const movie1 = await addTestMovie();
    const movie2 = await createMovie({ name: "Inception" });
    const movie3 = await createMovie({ name: "The Godfather", year: 1975 });

    await agent.post(`/api/ratings/${movie3.id}`).send({ rating: 7 });
    await agent.post(`/api/ratings/${movie1.id}`).send({ rating: 9 });
    await agent.post(`/api/ratings/${movie2.id}`).send({ rating: 8 });

    const allRatings = await agent.get("/api/ratings");
    const ratingsTyped = allRatings.body as UserMovieRating[];
    const movieIds = ratingsTyped.map((r) => r.movieId);
    expect(movieIds).toEqual([...movieIds].sort());
  });
});
