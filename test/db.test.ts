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
import { rateMovie } from "../src/db/queries/movieRatings.sql.js";
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
      imdbRating: 8.8,
      genre: "sci-fi",
    });

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
    const movie = await createMovie({ name: "Untitled" });

    expect(movie).toMatchObject({
      name: "Untitled",
      year: null,
      runtime: null,
      imdbRating: null,
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

  it("rejects an IMDb rating above 10 (zod validation)", async () => {
    const input = {
      name: "Inception",
      year: 2010,
      runtime: 148,
      imdbRating: 11,
    };
    const result = movieInputSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.format();
      expect(errors.imdbRating?._errors).toContain(
        "Too big: expected number to be <=10",
      );
    }
  });
});

describe("getAllMovies", () => {
  it("returns an empty list when there are no movies", async () => {
    expect(await getAllMovies(1, 20)).toEqual({
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

    const movies = await getAllMovies(1, 20);
    expect(movies.movies.map((m) => m.name).sort()).toEqual([
      "Inception",
      "Sicario",
    ]);
  });

  it("pages through movies ordered by name", async () => {
    await createTestMovie({ name: "Sicario" });
    await createTestMovie({ name: "Arrival" });
    await createTestMovie(); // Inception

    // Ascending by name: Arrival, Inception, Sicario.
    const firstPage = await getAllMovies(1, 2);
    expect(firstPage.movies.map((m) => m.name)).toEqual([
      "Arrival",
      "Inception",
    ]);
    expect(firstPage.total).toBe(3);
    expect(firstPage.totalPages).toBe(2);

    const secondPage = await getAllMovies(2, 2);
    expect(secondPage.movies.map((m) => m.name)).toEqual(["Sicario"]);
    expect(secondPage.totalPages).toBe(2);

    const pastEnd = await getAllMovies(5, 2);
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

    const rated = (await getAllMovies(1, 20)).movies.find(
      (m) => m.name === "Inception",
    );
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

    const movies = await getAllMovies(1, 20);
    expect(movies.movies.map((m) => m.name).sort()).toEqual([
      "Inception",
      "Sicario",
    ]);
    const unrated = movies.movies.find((m) => m.name === "Sicario");
    expect(unrated?.averageRating).toBeNull();
    expect(unrated?.ratingCount).toBe(0);
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

    const movies = await getAllMovies(1, 20);
    expect(movies.movies.map((m) => m.name)).toEqual(["Sicario"]);
  });

  it("is a no-op for an unknown UUID", async () => {
    await createTestMovie();

    await deleteMovie("00000000-0000-0000-0000-000000000000");

    expect((await getAllMovies(1, 20)).movies.map((m) => m.name)).toEqual([
      "Inception",
    ]);
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
      imdbRating: 8.7,
      genre: "sci-fi",
    });

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
    const movie = await createTestMovie();

    const updated = await updateMovie("00000000-0000-0000-0000-000000000000", {
      name: "Nope",
      year: 2020,
      runtime: 100,
      imdbRating: 5,
      genre: "drama",
    });

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
        "Too big: expected number to be <=2027",
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
      imdbRating: 8.7,
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
