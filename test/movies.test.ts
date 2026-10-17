import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { ZodError } from "zod";

vi.mock("../src/db/queries/movies.js", () => ({
  createMovie: vi.fn(),
  deleteMovie: vi.fn(),
  getAllMovies: vi.fn(),
  getMovieById: vi.fn(),
  getMoviesMetaData: vi.fn(),
  updateMovie: vi.fn(),
}));

import {
  createMovie,
  deleteMovie as deleteMovieQuery,
  getAllMovies,
  getMovieById,
  getMoviesMetaData,
  updateMovie,
} from "../src/db/queries/movies.js";
import { deleteMovie } from "../src/controllers/admin.js";
import {
  moviesCreate,
  moviesGetAll,
  moviesGetById,
  moviesMetaData,
  moviesUpdateById,
} from "../src/controllers/movies.js";
import type { Movie, MoviesMeta } from "../src/models/movies.js";

const movie: Movie = {
  id: "8fd27a76-dde8-41fb-8413-940aa9a2de21",
  createdAt: new Date("2026-10-10T15:30:23.341Z"),
  updatedAt: new Date("2026-10-10T15:30:23.341Z"),
  name: "The Matrix",
  year: 1999,
  runtime: 136,
  imdbRating: 8.7,
  genre: "sci-fi",
};

function makeRequest(
  overrides: {
    params?: Record<string, string>;
    body?: Record<string, unknown>;
  } = {},
): Request {
  return {
    params: overrides.params ?? {},
    body: overrides.body ?? {},
  } as unknown as Request;
}

function makeResponse(): Response {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    sendStatus: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("moviesGetAll", () => {
  it("responds with all movies", async () => {
    const movies = [movie, { ...movie, id: "b", name: "Inception" }];
    vi.mocked(getAllMovies).mockResolvedValue(movies);

    const res = makeResponse();
    await moviesGetAll(makeRequest(), res);

    expect(getAllMovies).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(movies);
  });

  it("rejects on query errors", async () => {
    vi.mocked(getAllMovies).mockRejectedValue(new Error("db down"));

    const res = makeResponse();
    await expect(moviesGetAll(makeRequest(), res)).rejects.toThrow("db down");

    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("moviesGetById", () => {
  it("looks up the id from req.params and responds 200 with the movie", async () => {
    vi.mocked(getMovieById).mockResolvedValue(movie);

    const res = makeResponse();
    await moviesGetById(makeRequest({ params: { id: movie.id } }), res);

    expect(getMovieById).toHaveBeenCalledWith(movie.id);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(movie);
  });

  it("responds 404 and no movie body when the id is unknown", async () => {
    vi.mocked(getMovieById).mockResolvedValue(undefined);

    const res = makeResponse();
    await moviesGetById(
      makeRequest({ params: { id: "00000000-0000-0000-0000-000000000000" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Movie not found" });
    expect(res.json).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.anything() }),
    );
  });

  it("rejects on query errors", async () => {
    vi.mocked(getMovieById).mockRejectedValue(new Error("db down"));

    const res = makeResponse();
    await expect(
      moviesGetById(makeRequest({ params: { id: movie.id } }), res),
    ).rejects.toThrow("db down");

    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("moviesCreate", () => {
  it("passes body fields to createMovie and responds 201 with the created movie", async () => {
    vi.mocked(createMovie).mockResolvedValue(movie);

    const res = makeResponse();
    const body = {
      name: "The Matrix",
      year: 1999,
      runtime: 136,
      imdbRating: 8.7,
      genre: "sci-fi",
    };
    await moviesCreate(makeRequest({ body }), res);

    expect(createMovie).toHaveBeenCalledWith({
      name: "The Matrix",
      year: 1999,
      runtime: 136,
      imdbRating: 8.7,
      genre: "sci-fi",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(movie);
  });

  it("rejects an invalid body without calling createMovie", async () => {
    await expect(
      moviesCreate(
        makeRequest({ body: { name: "The Matrix", year: 9999 } }),
        makeResponse(),
      ),
    ).rejects.toThrow(ZodError);

    expect(createMovie).not.toHaveBeenCalled();
  });

  it("rejects a body with a missing name without calling createMovie", async () => {
    await expect(
      moviesCreate(makeRequest({ body: { year: 1999 } }), makeResponse()),
    ).rejects.toThrow(ZodError);

    expect(createMovie).not.toHaveBeenCalled();
  });

  it("rejects on creation errors", async () => {
    vi.mocked(createMovie).mockRejectedValue(new Error("duplicate name"));

    const res = makeResponse();
    await expect(
      moviesCreate(makeRequest({ body: { name: "The Matrix" } }), res),
    ).rejects.toThrow("duplicate name");

    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("moviesUpdateById", () => {
  it("updates a movie by id", async () => {
    const updated: Movie = {
      ...movie,
      name: "The Matrix Reloaded",
      year: 2003,
    };
    vi.mocked(updateMovie).mockResolvedValue(updated);

    const res = makeResponse();
    const body = {
      name: "The Matrix Reloaded",
      year: 2003,
      runtime: 138,
      imdbRating: 7.4,
      genre: "sci-fi",
    };
    await moviesUpdateById(
      makeRequest({ params: { id: movie.id }, body }),
      res,
    );

    expect(updateMovie).toHaveBeenCalledWith(movie.id, {
      name: "The Matrix Reloaded",
      year: 2003,
      runtime: 138,
      imdbRating: 7.4,
      genre: "sci-fi",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(updated);
  });

  it("rejects an invalid body without calling updateMovie", async () => {
    const res = makeResponse();
    await expect(
      moviesUpdateById(
        makeRequest({
          params: { id: movie.id },
          body: { name: "X", runtime: 0 },
        }),
        res,
      ),
    ).rejects.toThrow(ZodError);

    expect(updateMovie).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("responds 404 when no movie matches the id", async () => {
    vi.mocked(updateMovie).mockResolvedValue(undefined as unknown as Movie);

    const res = makeResponse();
    await moviesUpdateById(
      makeRequest({ params: { id: movie.id }, body: { name: "The Matrix" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: `Failed to update movie ${movie.id}`,
    });
  });

  it("rejects on update errors", async () => {
    vi.mocked(updateMovie).mockRejectedValue(new Error("db down"));

    const res = makeResponse();
    await expect(
      moviesUpdateById(
        makeRequest({ params: { id: movie.id }, body: { name: "The Matrix" } }),
        res,
      ),
    ).rejects.toThrow("db down");

    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("deleteMovie", () => {
  it("deletes by the id from req.params and responds 204 without a body", async () => {
    vi.mocked(deleteMovieQuery).mockResolvedValue(undefined);

    const res = makeResponse();
    await deleteMovie(makeRequest({ params: { id: movie.id } }), res);

    expect(deleteMovieQuery).toHaveBeenCalledWith(movie.id);
    expect(res.sendStatus).toHaveBeenCalledWith(204);
    expect(res.json).not.toHaveBeenCalled();
  });

  it("rejects without responding when deletion fails", async () => {
    vi.mocked(deleteMovieQuery).mockRejectedValue(new Error("Invalid UUID"));

    const res = makeResponse();
    await expect(
      deleteMovie(makeRequest({ params: { id: "not-a-uuid" } }), res),
    ).rejects.toThrow("Invalid UUID");

    expect(res.sendStatus).not.toHaveBeenCalled();
  });
});

describe("moviesMetaData", () => {
  it("responds 200 with the movies metadata", async () => {
    const meta: MoviesMeta = {
      totalMovies: 42,
      moviesPerYear: [
        { year: 1999, count: 3 },
        { year: null, count: 1 },
      ],
      moviesPerGenre: [
        { genre: "sci-fi", count: 4 },
        { genre: null, count: 2 },
      ],
    };
    vi.mocked(getMoviesMetaData).mockResolvedValue(meta);

    const res = makeResponse();
    await moviesMetaData(makeRequest(), res);

    expect(getMoviesMetaData).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(meta);
  });

  it("rejects on query errors", async () => {
    vi.mocked(getMoviesMetaData).mockRejectedValue(new Error("db down"));

    const res = makeResponse();
    await expect(moviesMetaData(makeRequest(), res)).rejects.toThrow("db down");

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
