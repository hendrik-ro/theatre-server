import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "../src/db/index.js";
import {
  createMovie,
  deleteMovie,
  getAllMovies,
  getMovieById,
  getMoviesMetaData,
  resetMovies,
  updateMovie,
} from "../src/db/queries/movies.js";
import { firstOrUndefined } from "../src/db/queries/utils.js";

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE movies`);
});

describe("createMovie", () => {
  it("inserts a movie and returns the row with generated fields", async () => {
    const movie = await createMovie("Inception", 2010, 148, 8.8, "sci-fi");

    expect(movie).toMatchObject({
      name: "Inception",
      year: 2010,
      runtime: 148,
      imdbRating: 8.8,
      genre: "sci-fi",
    });
    expect(movie.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(movie.createdAt).toBeInstanceOf(Date);
    expect(movie.updatedAt).toBeInstanceOf(Date);
  });

  it("allows omitting every optional field", async () => {
    const movie = await createMovie("Untitled");

    expect(movie).toMatchObject({
      name: "Untitled",
      year: null,
      runtime: null,
      imdbRating: null,
      genre: null,
    });
  });

  it("rejects a duplicate name (unique constraint)", async () => {
    await createMovie("Inception");

    const err = await createMovie("Inception").then(
      () => null,
      (e: unknown) => e,
    );
    const code =
      (err as { code?: string })?.code ??
      (err as { cause?: { code?: string } })?.cause?.code ??
      undefined;
    expect(code).toBe("23505");
  });

  it("rejects a year outside the allowed range (check constraint)", async () => {
    const err = await createMovie("Back to the Future", 1000).then(
      () => null,
      (e: unknown) => e,
    );
    const code =
      (err as { code?: string })?.code ??
      (err as { cause?: { code?: string } })?.cause?.code ??
      undefined;
    expect(code).toBe("23514");
  });

  it("rejects a non-positive runtime (check constraint)", async () => {
    const err = await createMovie("Inception", 2010, 0).then(
      () => null,
      (e: unknown) => e,
    );
    const code =
      (err as { code?: string })?.code ??
      (err as { cause?: { code?: string } })?.cause?.code ??
      undefined;
    expect(code).toBe("23514");
  });

  it("rejects an IMDb rating above 10 (check constraint)", async () => {
    const err = await createMovie("Inception", 2010, 148, 11).then(
      () => null,
      (e: unknown) => e,
    );
    const code =
      (err as { code?: string })?.code ??
      (err as { cause?: { code?: string } })?.cause?.code ??
      undefined;
    expect(code).toBe("23514");
  });
});

describe("getAllMovies", () => {
  it("returns an empty list when there are no movies", async () => {
    expect(await getAllMovies()).toEqual([]);
  });

  it("returns all inserted movies", async () => {
    await createMovie("Inception", 2010);
    await createMovie("Sicario", 2015);

    const movies = await getAllMovies();
    expect(movies.map((m) => m.name).sort()).toEqual(["Inception", "Sicario"]);
  });
});

describe("getMovieById", () => {
  it("finds a movie by id", async () => {
    const created = await createMovie("Inception", 2010);

    expect(await getMovieById(created.id)).toEqual(created);
  });

  it("returns undefined for an unknown id", async () => {
    expect(await getMovieById("Nope")).toBeUndefined();
  });
});

describe("deleteMovie", () => {
  it("deletes a movie by UUID", async () => {
    const created = await createMovie("Inception", 2010);
    await deleteMovie(created.id);

    expect(await getMovieById(created.id)).toBeUndefined();
  });

  it("leaves other movies untouched", async () => {
    const inception = await createMovie("Inception", 2010);
    await createMovie("Sicario", 2015);

    await deleteMovie(inception.id);

    const movies = await getAllMovies();
    expect(movies.map((m) => m.name)).toEqual(["Sicario"]);
  });

  it("is a no-op for an unknown UUID", async () => {
    await createMovie("Inception", 2010);

    await deleteMovie("00000000-0000-0000-0000-000000000000");

    expect((await getAllMovies()).map((m) => m.name)).toEqual(["Inception"]);
  });

  it("rejects a malformed UUID", async () => {
    await expect(deleteMovie("not-a-uuid")).rejects.toThrow("Invalid UUID");
  });
});

describe("updateMovie", () => {
  it("updates a movie and returns the updated row", async () => {
    const movie = await createMovie("Inception", 2010);
    const updatedMovie = await updateMovie(
      movie.id,
      movie.name,
      2011,
      132,
      8.7,
      "sci-fi",
    );

    expect(updatedMovie).toMatchObject({
      createdAt: movie.createdAt,
      id: movie.id,
      name: "Inception",
      year: 2011,
      runtime: 132,
      imdbRating: 8.7,
      genre: "sci-fi",
    });
    expect(updatedMovie!.updatedAt.getTime()).toBeGreaterThanOrEqual(
      movie.updatedAt.getTime(),
    );
  });

  it("returns undefined when no movie matches the id", async () => {
    const movie = await createMovie("Inception", 2010);

    const updated = await updateMovie(
      "00000000-0000-0000-0000-000000000000",
      "Nope",
      2020,
      100,
      5,
      "drama",
    );

    expect(updated).toBeUndefined();
    expect((await getMovieById(movie.id))?.name).toBe("Inception");
  });

  it("rejects a malformed UUID", async () => {
    await expect(updateMovie("not-a-uuid", "Nope")).rejects.toThrow(
      "Invalid UUID",
    );
  });

  it("enforces the check constraints on update", async () => {
    const movie = await createMovie("Inception", 2010);

    const err = await updateMovie(movie.id, "Inception", 2200).then(
      () => null,
      (e: unknown) => e,
    );
    const code =
      (err as { code?: string })?.code ??
      (err as { cause?: { code?: string } })?.cause?.code ??
      undefined;
    expect(code).toBe("23514");
  });
});

describe("resetMovies", () => {
  it("resets the movie table", async () => {
    await createMovie("Inception", 2010);
    await createMovie("Sicario", 2015);
    const movies = await getAllMovies();
    expect(movies.map((m) => m.name).sort()).toEqual(["Inception", "Sicario"]);

    await resetMovies();
    expect(await getAllMovies()).toEqual([]);
  });
});

describe("firstOrUndefined", () => {
  it("returns undefined for an empty array", () => {
    expect(firstOrUndefined([])).toBeUndefined();
  });

  it("returns the first element without touching the rest", () => {
    expect(firstOrUndefined([1, 2, 3])).toBe(1);
  });
});

describe("getMoviesMetaData", () => {
  it("returns a MoviesMeta object for an empty database", async () => {
    const meta = await getMoviesMetaData();
    expect(meta).toMatchObject({
      totalMovies: 0,
      moviesPerYear: [],
      moviesPerGenre: [],
    });
  });

  it("MoviesMeta`s properties reflect database state", async () => {
    await createMovie("Inception", 2010, 175, 8.7, "sci-fi");
    await createMovie("Sicario", 2015);

    const meta = await getMoviesMetaData();
    expect(meta).toMatchObject({
      totalMovies: 2,
      moviesPerYear: [
        { year: 2010, count: 1 },
        { year: 2015, count: 1 },
      ],
      moviesPerGenre: [
        { genre: "sci-fi", count: 1 },
        { genre: null, count: 1 },
      ],
    });
  });
});
