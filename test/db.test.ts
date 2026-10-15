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
import {
  createUser,
  deleteUser,
  getAllUsers,
  getUserById,
  resetUsers,
} from "../src/db/queries/users.js";
import { firstOrUndefined } from "../src/db/queries/utils.js";
import { movieInputSchema } from "../src/models/movies.js";

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE movies, users`);
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

  it("sets role to admin when specified", async () => {
    const user = await createUser(
      "admin",
      "admin@example.com",
      "admin_hash",
      "admin",
    );

    expect(user.role).toBe("admin");
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

    const err = await createUser("john", "another@example.com", "hash2").then(
      () => null,
      (e: unknown) => e,
    );
    const code =
      (err as { code?: string })?.code ??
      (err as { cause?: { code?: string } })?.cause?.code ??
      undefined;
    expect(code).toBe("23505");
  });

  it("rejects duplicate email (unique constraint)", async () => {
    await createUser("john", "shared@example.com", "hashed_password");

    const err = await createUser("jane", "shared@example.com", "hash2").then(
      () => null,
      (e: unknown) => e,
    );
    const code =
      (err as { code?: string })?.code ??
      (err as { cause?: { code?: string } })?.cause?.code ??
      undefined;
    expect(code).toBe("23505");
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

describe("resetUsers", () => {
  it("resets the users table", async () => {
    await createUser("john", "john@example.com", "hash1");
    await createUser("jane", "jane@example.com", "hash2");
    const users = await getAllUsers();
    expect(users.map((u) => u.username).sort()).toEqual(["jane", "john"]);

    await resetUsers();
    expect(await getAllUsers()).toEqual([]);
  });
});
