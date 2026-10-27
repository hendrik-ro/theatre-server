import { beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { db } from "../src/db/index.js";
import {
  createMovie,
  deleteMovie,
  getAllMovies,
  getMovieById,
  getMoviesMetaData,
  updateMovie,
} from "../src/db/queries/movies.js";
import { rateMovie } from "../src/db/queries/movieRatings.js";
import {
  createUser,
  deleteUser,
  getAllUsers,
  getUserById,
} from "../src/db/queries/users.js";
import { firstOrUndefined } from "../src/db/queries/utils.js";
import { users } from "../src/db/schema/users.sql.js";
import { movieInputSchema } from "../src/models/movies.js";
import { createTestMovie, resetDB } from "./helpers.js";

// Runs a promise expected to reject with a Postgres error (possibly
// wrapped in a cause) and returns the SQLSTATE code it failed with.
async function pgErrorCode(
  promise: Promise<unknown>,
): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (err) {
    return (
      (err as { code?: string })?.code ??
      (err as { cause?: { code?: string } })?.cause?.code
    );
  }
}

beforeEach(async () => {
  await resetDB();
  // Pre-seed the first-admin claim so createUser in the generic suites
  // below deterministically gets role "user"; the bootstrap describe
  // starts from a fresh claim instead.
  await db.execute(sql`INSERT INTO app_bootstrap (key) VALUES ('first_admin')`);
});

describe("createMovie", () => {
  it("inserts a movie and returns the row with generated fields", async () => {
    const movie = await createMovie({
      name: "Inception",
      year: 2010,
      runtime: 148,
      genre: "sci-fi",
    });

    expect(movie).toMatchObject({
      name: "Inception",
      year: 2010,
      runtime: 148,
      genre: "sci-fi",
    });
    expect(movie.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(movie.createdAt).toBeInstanceOf(Date);
    expect(movie.updatedAt).toBeInstanceOf(Date);
  });

  it("allows omitting every optional field", async () => {
    const movie = await createMovie({ name: "Untitled" });

    expect(movie).toMatchObject({
      name: "Untitled",
      year: null,
      runtime: null,
      genre: null,
    });
  });

  it("rejects a duplicate name (unique constraint)", async () => {
    await createMovie({ name: "Inception" });

    expect(await pgErrorCode(createMovie({ name: "Inception" }))).toBe("23505");
  });

  it("rejects a year outside the allowed range (zod validation)", async () => {
    const input = { name: "Back to the Future", year: 1000 };
    const result = movieInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.format();
      expect(errors.year?._errors).toContain(
        "Too small: expected number to be >=1750",
      );
    }
  });

  it("rejects a non-positive runtime (zod validation)", async () => {
    const input = { name: "Inception", year: 2010, runtime: 0 };
    const result = movieInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.format();
      expect(errors.runtime?._errors).toContain(
        "Too small: expected number to be >=1",
      );
    }
  });

  describe("getAllMovies", () => {
    it("returns an empty list when there are no movies", async () => {
      expect(
        await getAllMovies(
          1,
          20,
          {},
          { sortBy: "year", sortDir: "asc" },
          undefined,
        ),
      ).toEqual({
        movies: [],
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
      });
    });

    it("returns all inserted movies", async () => {
      await createTestMovie();
      await createTestMovie({ name: "Sicario", year: 2015 });

      const movies = await getAllMovies(
        1,
        20,
        {},
        {
          sortBy: "year",
          sortDir: "asc",
        },
        undefined,
      );
      expect(movies.movies.map((m) => m.name).sort()).toEqual([
        "Inception",
        "Sicario",
      ]);
    });

    it("pages through movies ordered by name", async () => {
      await createTestMovie({ name: "Sicario", year: 2000 });
      await createTestMovie({ name: "Arrival", year: 2000 });
      await createTestMovie({ name: "Inception", year: 2000 });

      // Ascending by name: Arrival, Inception, Sicario.
      const firstPage = await getAllMovies(
        1,
        2,
        {},
        {
          sortBy: "name",
          sortDir: "asc",
        },
        undefined,
      );
      expect(firstPage.movies.map((m) => m.name)).toEqual([
        "Arrival",
        "Inception",
      ]);
      expect(firstPage.total).toBe(3);
      expect(firstPage.totalPages).toBe(2);

      const secondPage = await getAllMovies(
        2,
        2,
        {},
        {
          sortBy: "name",
          sortDir: "asc",
        },
        undefined,
      );
      expect(secondPage.movies.map((m) => m.name)).toEqual(["Sicario"]);
      expect(secondPage.totalPages).toBe(2);

      const pastEnd = await getAllMovies(
        5,
        2,
        {},
        {
          sortBy: "name",
          sortDir: "asc",
        },
        undefined,
      );
      expect(pastEnd.movies).toEqual([]);
    });

    it("returns the community average rounded to one decimal", async () => {
      const alice = await createUser("alice", "alice@example.com", "hash1");
      const bob = await createUser("bob", "bob@example.com", "hash2");
      const carol = await createUser("carol", "carol@example.com", "hash3");
      const inception = await createTestMovie();

      // (9 + 9 + 8) / 3 = 8.666… — exercises the SQL ROUND, not just a
      // value that happens to have one decimal.
      await rateMovie(alice.id, inception.id, 9);
      await rateMovie(bob.id, inception.id, 9);
      await rateMovie(carol.id, inception.id, 8);

      const rated = (
        await getAllMovies(
          1,
          20,
          {},
          {
            sortBy: "name",
            sortDir: "asc",
          },
          undefined,
        )
      ).movies.find((m) => m.name === "Inception");
      expect(rated?.averageRating).toBe(8.7);
      expect(rated?.ratingCount).toBe(3);
      // pg returns numeric as a string; the query layer must convert it.
      expect(typeof rated?.averageRating).toBe("number");
    });

    it("keeps unrated movies in the list with a null average", async () => {
      const alice = await createUser("alice", "alice@example.com", "hash1");
      const inception = await createTestMovie();
      await createTestMovie({ name: "Sicario", year: 2015 });

      await rateMovie(alice.id, inception.id, 7);

      const movies = await getAllMovies(
        1,
        20,
        {},
        {
          sortBy: "name",
          sortDir: "asc",
        },
        undefined,
      );
      expect(movies.movies.map((m) => m.name).sort()).toEqual([
        "Inception",
        "Sicario",
      ]);
      const unrated = movies.movies.find((m) => m.name === "Sicario");
      expect(unrated?.averageRating).toBeNull();
      expect(unrated?.ratingCount).toBe(0);
    });

    // === Filter Tests ===

    describe("filtering", () => {
      it("filters movies by year", async () => {
        await createTestMovie({
          name: "Movie 1999",
          year: 1999,
          genre: "sci-fi",
        });
        await createTestMovie({
          name: "Movie 2001",
          year: 2001,
          genre: "sci-fi",
        });
        await createTestMovie({
          name: "Movie 2010",
          year: 2010,
          genre: "drama",
        });

        const result = await getAllMovies(
          1,
          20,
          { year: 2010 },
          {
            sortBy: "name",
            sortDir: "asc",
          },
          undefined,
        );
        expect(result.movies.map((m) => m.name)).toEqual(["Movie 2010"]);
        expect(result.total).toBe(1);
      });

      it("filters movies by genre with partial matching (LIKE)", async () => {
        await createTestMovie({ name: "Inception", genre: "science-fiction" });
        await createTestMovie({ name: "Interstellar", genre: "sci-fi" });
        await createTestMovie({ name: "Titanic", genre: "drama" });

        const result = await getAllMovies(
          1,
          20,
          { genre: "sci" },
          {
            sortBy: "name",
            sortDir: "asc",
          },
          undefined,
        );
        expect(result.movies.map((m) => m.name).sort()).toEqual([
          "Inception",
          "Interstellar",
        ]);
        expect(result.total).toBe(2);
      });

      it("applies multiple filters with AND logic", async () => {
        await createTestMovie({
          name: "Match",
          year: 2010,
          genre: "sci-fi",
        });
        await createTestMovie({
          name: "Wrong Year",
          year: 2000,
          genre: "sci-fi",
        });
        await createTestMovie({
          name: "Wrong Genre",
          year: 2010,
          genre: "drama",
        });

        const result = await getAllMovies(
          1,
          20,
          {
            year: 2010,
            genre: "sci-fi",
          },
          {
            sortBy: "name",
            sortDir: "asc",
          },
          undefined,
        );
        expect(result.movies.map((m) => m.name)).toEqual(["Match"]);
        expect(result.total).toBe(1);
      });

      it("filters by genre and averageRating combined", async () => {
        const alice = await createUser("alice", "a@example.com", "hash1");
        const bob = await createUser("bob", "b@example.com", "hash2");

        const sciFiRated = await createTestMovie({
          name: "Sci-Fi High",
          genre: "sci-fi",
        });
        const dramaRated = await createTestMovie({
          name: "Drama High",
          genre: "drama",
        });

        await rateMovie(alice.id, sciFiRated.id, 9);
        await rateMovie(bob.id, sciFiRated.id, 9);
        await rateMovie(alice.id, dramaRated.id, 9);
        await rateMovie(bob.id, dramaRated.id, 9);

        const result = await getAllMovies(
          1,
          20,
          {
            genre: "sci-fi",
            averageRating: 9,
          },
          {
            sortBy: "name",
            sortDir: "asc",
          },
          undefined,
        );
        expect(result.movies.map((m) => m.name)).toEqual(["Sci-Fi High"]);
        expect(result.total).toBe(1);
      });

      it("returns all movies when filters are undefined", async () => {
        await createTestMovie({ name: "Movie 1" });
        await createTestMovie({ name: "Movie 2" });

        const result = await getAllMovies(
          1,
          20,
          {},
          {
            sortBy: "name",
            sortDir: "asc",
          },
          undefined,
        );
        expect(result.movies.map((m) => m.name).sort()).toEqual([
          "Movie 1",
          "Movie 2",
        ]);
        expect(result.total).toBe(2);
      });

      it("returns all movies when filter is empty object", async () => {
        await createTestMovie({ name: "Movie 1" });
        await createTestMovie({ name: "Movie 2" });

        const result = await getAllMovies(
          1,
          20,
          {},
          {
            sortBy: "name",
            sortDir: "asc",
          },
          undefined,
        );
        expect(result.movies.length).toBe(2);
      });

      it("returns empty array when no movies match filter", async () => {
        await createTestMovie({ name: "Movie", year: 2000 });

        const result = await getAllMovies(
          1,
          20,
          { year: 1990 },
          {
            sortBy: "name",
            sortDir: "asc",
          },
          undefined,
        );
        expect(result.movies).toEqual([]);
        expect(result.total).toBe(0);
        expect(result.totalPages).toBe(0);
      });

      it("applies filter with pagination", async () => {
        for (let i = 1; i <= 5; i++) {
          await createTestMovie({
            name: `Sci-Fi ${i}`,
            genre: "sci-fi",
            year: 2000,
          });
        }
        for (let i = 1; i <= 3; i++) {
          await createTestMovie({
            name: `Drama ${i}`,
            genre: "drama",
            year: 2000,
          });
        }

        const page1 = await getAllMovies(
          1,
          2,
          { genre: "sci-fi" },
          { sortBy: "name", sortDir: "asc" },
          undefined,
        );
        expect(page1.movies.map((m) => m.name)).toEqual([
          "Sci-Fi 1",
          "Sci-Fi 2",
        ]);
        expect(page1.total).toBe(5);
        expect(page1.totalPages).toBe(3);

        const page2 = await getAllMovies(
          2,
          2,
          { genre: "sci-fi" },
          { sortBy: "name", sortDir: "asc" },
          undefined,
        );
        expect(page2.movies.map((m) => m.name)).toEqual([
          "Sci-Fi 3",
          "Sci-Fi 4",
        ]);
      });

      // === Edge Case Tests: Zero Values ===

      it("filters movies by year=0", async () => {
        await createTestMovie({ name: "Year Zero", year: 0, genre: "drama" });
        await createTestMovie({
          name: "Year 1990",
          year: 1990,
          genre: "drama",
        });

        const result = await getAllMovies(
          1,
          20,
          { year: 0 },
          {
            sortBy: "name",
            sortDir: "asc",
          },
          undefined,
        );
        expect(result.movies.map((m) => m.name)).toEqual(["Year Zero"]);
        expect(result.total).toBe(1);
      });

      it("filters movies by averageRating=1 (gte behavior)", async () => {
        const alice = await createUser("alice", "a@example.com", "hash1");
        const zeroRated = await createTestMovie({ name: "Zero Rated" });
        await rateMovie(alice.id, zeroRated.id, 1);

        // With gte, filtering by 0 returns all movies since all ratings >= 0
        // Create another rated movie to verify
        const normalRated = await createTestMovie({ name: "Normal Rated" });
        await rateMovie(alice.id, normalRated.id, 5);

        const result = await getAllMovies(
          1,
          20,
          { averageRating: 1 },
          {
            sortBy: "name",
            sortDir: "asc",
          },
          undefined,
        );
        expect(result.movies.map((m) => m.name).sort()).toEqual([
          "Normal Rated",
          "Zero Rated",
        ]);
        expect(result.total).toBe(2);
      });

      // === Edge Case Tests: Null Values ===

      it("filters movies by null year", async () => {
        await createTestMovie({ name: "No Year", year: null, genre: "drama" });
        await createTestMovie({ name: "Has Year", year: 2000, genre: "drama" });

        const result = await getAllMovies(
          1,
          20,
          { year: null },
          {
            sortBy: "name",
            sortDir: "asc",
          },
          undefined,
        );
        expect(result.movies.map((m) => m.name)).toEqual(["No Year"]);
        expect(result.total).toBe(1);
      });

      it("filters movies by null genre", async () => {
        await createTestMovie({ name: "No Genre", genre: null });
        await createTestMovie({ name: "Has Genre", genre: "drama" });

        const result = await getAllMovies(
          1,
          20,
          { genre: null },
          {
            sortBy: "name",
            sortDir: "asc",
          },
          undefined,
        );
        expect(result.movies.map((m) => m.name)).toEqual(["No Genre"]);
        expect(result.total).toBe(1);
      });

      it("filters movies by null averageRating (unrated)", async () => {
        await createTestMovie({ name: "Unrated", genre: "drama" });
        const rated = await createTestMovie({ name: "Rated", genre: "drama" });
        const user = await createUser("user", "u@example.com", "hash");
        await rateMovie(user.id, rated.id, 5);

        const result = await getAllMovies(
          1,
          20,
          { averageRating: null },
          {
            sortBy: "name",
            sortDir: "asc",
          },
          undefined,
        );
        expect(result.movies.map((m) => m.name)).toEqual(["Unrated"]);
        expect(result.total).toBe(1);
      });

      // === Edge Case Tests: Combined ===

      it("filters by year=0 AND genre=null", async () => {
        await createTestMovie({ name: "Match", year: 0, genre: null });
        await createTestMovie({ name: "Wrong Year", year: 2000, genre: null });
        await createTestMovie({ name: "Wrong Genre", year: 0, genre: "drama" });

        const result = await getAllMovies(
          1,
          20,
          { year: 0, genre: null },
          { sortBy: "name", sortDir: "asc" },
          undefined,
        );
        expect(result.movies.map((m) => m.name)).toEqual(["Match"]);
        expect(result.total).toBe(1);
      });

      it("handles mixed null and zero values together", async () => {
        await createTestMovie({
          name: "All Edge",
          year: 0,
          genre: null,
        });
        await createTestMovie({
          name: "Normal",
          year: 2000,
          genre: "drama",
        });
        await createTestMovie({
          name: "Partial",
          year: null,
          genre: "sci-fi",
        });

        let result = await getAllMovies(
          1,
          20,
          { year: 0 },
          {
            sortBy: "name",
            sortDir: "asc",
          },
          undefined,
        );
        expect(result.movies.length).toBe(1);
        expect(result.movies[0].name).toBe("All Edge");

        result = await getAllMovies(
          1,
          20,
          { genre: null },
          {
            sortBy: "name",
            sortDir: "asc",
          },
          undefined,
        );
        expect(result.movies.length).toBe(1);
        expect(result.movies[0].name).toBe("All Edge");
      });

      it("filters movies by search (name) with partial matching", async () => {
        await createTestMovie({ name: "The Matrix", year: 1999 });
        await createTestMovie({ name: "Inception", year: 2010 });
        await createTestMovie({ name: "Matrix Reloaded", year: 2003 });
        await createTestMovie({ name: "Interstellar", year: 2014 });

        const result = await getAllMovies(
          1,
          20,
          { search: "Matrix" },
          {
            sortBy: "name",
            sortDir: "asc",
          },
          undefined,
        );
        expect(result.movies.map((m) => m.name).sort()).toEqual([
          "Matrix Reloaded",
          "The Matrix",
        ]);
        expect(result.total).toBe(2);
      });

      it("returns empty array when search matches no movies", async () => {
        await createTestMovie({ name: "Inception" });

        const result = await getAllMovies(
          1,
          20,
          { search: "NonExistent" },
          {
            sortBy: "name",
            sortDir: "asc",
          },
          undefined,
        );
        expect(result.movies).toEqual([]);
        expect(result.total).toBe(0);
      });

      it("handles empty search string", async () => {
        await createTestMovie({ name: "Inception" });
        await createTestMovie({ name: "The Matrix" });

        const result = await getAllMovies(
          1,
          20,
          { search: "" },
          {
            sortBy: "name",
            sortDir: "asc",
          },
          undefined,
        );
        expect(result.movies.map((m) => m.name).sort()).toEqual([
          "Inception",
          "The Matrix",
        ]);
        expect(result.total).toBe(2);
      });

      it("combines search with other filters", async () => {
        await createTestMovie({
          name: "The Matrix",
          year: 1999,
          genre: "sci-fi",
        });
        await createTestMovie({
          name: "Matrix Code",
          year: 2000,
          genre: "drama",
        });
        await createTestMovie({
          name: "Inception",
          year: 2010,
          genre: "sci-fi",
        });

        const result = await getAllMovies(
          1,
          20,
          {
            search: "Matrix",
            genre: "sci-fi",
          },
          {
            sortBy: "name",
            sortDir: "asc",
          },
          undefined,
        );
        expect(result.movies.map((m) => m.name)).toEqual(["The Matrix"]);
        expect(result.total).toBe(1);
      });

      it("search is case-insensitive", async () => {
        await createTestMovie({ name: "The Matrix" });
        await createTestMovie({ name: "inception" });

        const result = await getAllMovies(
          1,
          20,
          { search: "MATRIX" },
          {
            sortBy: "name",
            sortDir: "asc",
          },
          undefined,
        );
        expect(result.movies.map((m) => m.name)).toEqual(["The Matrix"]);
        expect(result.total).toBe(1);
      });
    });
  });

  describe("getMovieById", () => {
    it("finds a movie by id", async () => {
      const created = await createTestMovie();

      const found = await getMovieById(created.id);
      expect(found).toMatchObject({
        id: created.id,
        name: "Inception",
        year: 2010,
      });
      expect(found?.averageRating).toBeNull();
      expect(found?.ratingCount).toBe(0);
    });

    it("returns undefined for an unknown id", async () => {
      expect(await getMovieById("Nope")).toBeUndefined();
    });

    it("returns the community average for a rated movie", async () => {
      const alice = await createUser("alice", "alice@example.com", "hash1");
      const bob = await createUser("bob", "bob@example.com", "hash2");
      const carol = await createUser("carol", "carol@example.com", "hash3");
      const inception = await createTestMovie();

      await rateMovie(alice.id, inception.id, 9);
      await rateMovie(bob.id, inception.id, 9);
      await rateMovie(carol.id, inception.id, 8);

      const found = await getMovieById(inception.id);
      expect(found?.averageRating).toBe(8.7);
      expect(found?.ratingCount).toBe(3);
      expect(typeof found?.averageRating).toBe("number");
    });

    it("returns a whole-number average as a number, not a string", async () => {
      const alice = await createUser("alice", "alice@example.com", "hash1");
      const inception = await createTestMovie();

      // ROUND(AVG(8), 1) comes back from pg as "8.0": without the
      // string-to-number conversion this would fail on "8.0" !== 8.
      await rateMovie(alice.id, inception.id, 8);

      const found = await getMovieById(inception.id);
      expect(found?.averageRating).toBe(8);
      expect(typeof found?.averageRating).toBe("number");
    });
  });

  describe("deleteMovie", () => {
    it("deletes a movie by UUID", async () => {
      const created = await createTestMovie();
      await deleteMovie(created.id);

      expect(await getMovieById(created.id)).toBeUndefined();
    });

    it("leaves other movies untouched", async () => {
      const inception = await createTestMovie();
      await createTestMovie({ name: "Sicario", year: 2015 });

      await deleteMovie(inception.id);

      const movies = await getAllMovies(
        1,
        20,
        {},
        {
          sortBy: "name",
          sortDir: "asc",
        },
        undefined,
      );
      expect(movies.movies.map((m) => m.name)).toEqual(["Sicario"]);
    });

    it("is a no-op for an unknown UUID", async () => {
      await createTestMovie();

      await deleteMovie("00000000-0000-0000-0000-000000000000");

      expect(
        (
          await getAllMovies(
            1,
            20,
            {},
            {
              sortBy: "name",
              sortDir: "asc",
            },
            undefined,
          )
        ).movies.map((m) => m.name),
      ).toEqual(["Inception"]);
    });

    it("rejects a malformed UUID", async () => {
      await expect(deleteMovie("not-a-uuid")).rejects.toThrow("Invalid UUID");
    });
  });

  describe("updateMovie", () => {
    it("updates a movie and returns the updated row", async () => {
      const movie = await createTestMovie();
      const updatedMovie = await updateMovie(movie.id, {
        name: movie.name,
        year: 2011,
        runtime: 132,
        genre: "sci-fi",
      });

      expect(updatedMovie).toMatchObject({
        createdAt: movie.createdAt,
        id: movie.id,
        name: "Inception",
        year: 2011,
        runtime: 132,
        genre: "sci-fi",
      });
      expect(updatedMovie!.updatedAt.getTime()).toBeGreaterThanOrEqual(
        movie.updatedAt.getTime(),
      );
    });

    it("returns undefined when no movie matches the id", async () => {
      const movie = await createTestMovie();

      const updated = await updateMovie(
        "00000000-0000-0000-0000-000000000000",
        {
          name: "Nope",
          year: 2020,
          runtime: 100,
          genre: "drama",
        },
      );

      expect(updated).toBeUndefined();
      expect((await getMovieById(movie.id))?.name).toBe("Inception");
    });

    it("rejects a malformed UUID", async () => {
      await expect(updateMovie("not-a-uuid", { name: "Nope" })).rejects.toThrow(
        "Invalid UUID",
      );
    });

    it("enforces the zod constraints on update", async () => {
      const input = { name: "Inception", year: 2200 };
      const result = movieInputSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = result.error.format();
        expect(errors.year?._errors).toContain(
          "Year cannot be more than one year in the future",
        );
      }
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
      await createMovie({
        name: "Inception",
        year: 2010,
        runtime: 175,
        genre: "sci-fi",
      });
      await createMovie({ name: "Sicario", year: 2015 });

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

  describe("createUser", () => {
    it("inserts a user and returns the row with generated fields", async () => {
      const user = await createUser(
        "john",
        "john@example.com",
        "hashed_password",
      );

      expect(user).toMatchObject({
        username: "john",
        email: "john@example.com",
        passwordHash: "hashed_password",
        role: "user",
      });
      expect(user.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(user.createdAt).toBeInstanceOf(Date);
      expect(user.updatedAt).toBeInstanceOf(Date);
      expect(user.emailVerifiedAt).toBeNull();
      expect(user.lastLoginAt).toBeNull();
    });

    it("stores email in lowercase", async () => {
      const user = await createUser(
        "john",
        "JOHN@EXAMPLE.COM",
        "hashed_password",
      );

      expect(user.email).toBe("john@example.com");
    });

    it("rejects duplicate name (unique constraint)", async () => {
      await createUser("john", "john@example.com", "hashed_password");

      expect(
        await pgErrorCode(createUser("john", "another@example.com", "hash2")),
      ).toBe("23505");
    });

    it("rejects duplicate email (unique constraint)", async () => {
      await createUser("john", "shared@example.com", "hashed_password");

      expect(
        await pgErrorCode(createUser("jane", "shared@example.com", "hash2")),
      ).toBe("23505");
    });
  });

  describe("bootstrap", () => {
    // Undo the claim the global beforeEach pre-seeds: these tests exercise
    // the claim itself and each needs to start from an empty app_bootstrap.
    beforeEach(async () => {
      await db.execute(sql`TRUNCATE TABLE app_bootstrap`);
    });

    it("the first created user becomes admin, the second stays user", async () => {
      const first = await createUser("alice", "alice@example.com", "hash1");
      const second = await createUser("bob", "bob@example.com", "hash2");

      expect(first.role).toBe("admin");
      expect(second.role).toBe("user");
    });

    it("a failed first creation releases the claim", async () => {
      // A user row that exists without having claimed (inserted directly)
      // makes createUser's insert fail on the unique constraint after the
      // claim was taken; the transaction must roll the claim back so the
      // next createUser can still become admin.
      await db.insert(users).values({
        username: "john",
        email: "john@example.com",
        passwordHash: "hash",
        role: "user",
      });

      expect(
        await pgErrorCode(createUser("john", "another@example.com", "hash2")),
      ).toBe("23505");

      const retry = await createUser("jane", "jane@example.com", "hash3");
      expect(retry.role).toBe("admin");
    });
  });

  describe("getAllUsers", () => {
    it("returns an empty list when there are no users", async () => {
      expect(await getAllUsers()).toEqual([]);
    });

    it("returns all inserted users", async () => {
      await createUser("john", "john@example.com", "hash1");
      await createUser("jane", "jane@example.com", "hash2");

      const users = await getAllUsers();
      expect(users.map((u) => u.username).sort()).toEqual(["jane", "john"]);
    });
  });

  describe("getUserById", () => {
    it("finds a user by id", async () => {
      const created = await createUser("john", "john@example.com", "hash");

      expect(await getUserById(created.id)).toEqual(created);
    });

    it("returns undefined for an unknown id", async () => {
      expect(
        await getUserById("00000000-0000-0000-0000-000000000000"),
      ).toBeUndefined();
    });

    it("rejects a malformed UUID", async () => {
      await expect(getUserById("not-a-uuid")).rejects.toThrow("Invalid UUID");
    });
  });

  describe("deleteUser", () => {
    it("deletes a user by UUID", async () => {
      const created = await createUser("john", "john@example.com", "hash");
      await deleteUser(created.id);

      expect(await getUserById(created.id)).toBeUndefined();
    });

    it("leaves other users untouched", async () => {
      const john = await createUser("john", "john@example.com", "hash1");
      await createUser("jane", "jane@example.com", "hash2");

      await deleteUser(john.id);

      const users = await getAllUsers();
      expect(users.map((u) => u.username)).toEqual(["jane"]);
    });

    it("is a no-op for an unknown UUID", async () => {
      await createUser("john", "john@example.com", "hash");

      await deleteUser("00000000-0000-0000-0000-000000000000");

      expect((await getAllUsers()).map((u) => u.username)).toEqual(["john"]);
    });

    it("rejects a malformed UUID", async () => {
      await expect(deleteUser("not-a-uuid")).rejects.toThrow("Invalid UUID");
    });
  });
});
