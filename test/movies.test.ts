import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";

vi.mock("../src/db/queries/movies.js", () => ({
  createMovie: vi.fn(),
  deleteMovie: vi.fn(),
  getAllMovies: vi.fn(),
  getMovieById: vi.fn(),
  updateMovie: vi.fn(),
}));

import {
  createMovie,
  deleteMovie,
  getAllMovies,
  getMovieById,
  updateMovie,
} from "../src/db/queries/movies.js";
import {
  moviesCreate,
  moviesDeleteById,
  moviesGetAll,
  moviesGetById,
  moviesUpdateById,
} from "../src/controllers/movies.js";
import type { Movie } from "../src/models/movies.js";

const movie: Movie = {
  id: "8fd27a76-dde8-41fb-8413-940aa9a2de21",
  createdAt: new Date("2026-10-10T15:30:23.341Z"),
  updatedAt: new Date("2026-10-10T15:30:23.341Z"),
  name: "The Matrix",
  year: 1999,
  runtime: 136,
  imdbRating: 87,
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
  };
  return res as unknown as Response;
}

function makeNext(): NextFunction {
  return vi.fn();
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("moviesGetAll", () => {
  it("responds 200 with all movies", async () => {
    const movies = [movie, { ...movie, id: "b", name: "Inception" }];
    vi.mocked(getAllMovies).mockResolvedValue(movies);

    const res = makeResponse();
    await moviesGetAll(makeRequest(), res, makeNext());

    expect(getAllMovies).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(movies);
  });

  it("forwards query errors to next", async () => {
    vi.mocked(getAllMovies).mockRejectedValue(new Error("db down"));

    const res = makeResponse();
    const next = makeNext();
    await moviesGetAll(makeRequest(), res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: "db down" }),
    );
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("moviesGetById", () => {
  it("looks up the id from req.params and responds 200 with the movie", async () => {
    vi.mocked(getMovieById).mockResolvedValue(movie);

    const res = makeResponse();
    await moviesGetById(
      makeRequest({ params: { id: movie.id } }),
      res,
      makeNext(),
    );

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
      makeNext(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Movie not found" });
    expect(res.json).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: expect.anything() }),
    );
  });

  it("forwards query errors to next", async () => {
    vi.mocked(getMovieById).mockRejectedValue(new Error("db down"));

    const res = makeResponse();
    const next = makeNext();
    await moviesGetById(makeRequest({ params: { id: movie.id } }), res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: "db down" }),
    );
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
      imbdRating: 8.7,
      genre: "sci-fi",
    };
    await moviesCreate(makeRequest({ body }), res, makeNext());

    expect(createMovie).toHaveBeenCalledWith(
      "The Matrix",
      1999,
      136,
      8.7,
      "sci-fi",
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(movie);
  });

  it("forwards creation errors to next", async () => {
    vi.mocked(createMovie).mockRejectedValue(new Error("duplicate name"));

    const res = makeResponse();
    const next = makeNext();
    await moviesCreate(
      makeRequest({ body: { name: "The Matrix" } }),
      res,
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: "duplicate name" }),
    );
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
      makeNext(),
    );

    expect(updateMovie).toHaveBeenCalledWith(
      movie.id,
      "The Matrix Reloaded",
      2003,
      138,
      7.4,
      "sci-fi",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(updated);
  });

  it("responds 404 when no movie matches the id", async () => {
    vi.mocked(updateMovie).mockResolvedValue(undefined as unknown as Movie);

    const res = makeResponse();
    await moviesUpdateById(
      makeRequest({ params: { id: movie.id }, body: { name: "The Matrix" } }),
      res,
      makeNext(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: `Failed to update movie ${movie.id}`,
    });
  });

  it("forwards update errors to next", async () => {
    vi.mocked(updateMovie).mockRejectedValue(new Error("db down"));

    const res = makeResponse();
    const next = makeNext();
    await moviesUpdateById(
      makeRequest({ params: { id: movie.id }, body: { name: "The Matrix" } }),
      res,
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: "db down" }),
    );
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("moviesDeleteById", () => {
  it("deletes by the id from req.params and responds 200 with a confirmation message", async () => {
    vi.mocked(deleteMovie).mockResolvedValue(undefined);

    const res = makeResponse();
    await moviesDeleteById(
      makeRequest({ params: { id: movie.id } }),
      res,
      makeNext(),
    );

    expect(deleteMovie).toHaveBeenCalledWith(movie.id);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: `Movie ${movie.id} has been deleted`,
    });
  });

  it("does not send a body when deletion fails", async () => {
    vi.mocked(deleteMovie).mockRejectedValue(new Error("Invalid UUID"));

    const res = makeResponse();
    const next = makeNext();
    await moviesDeleteById(
      makeRequest({ params: { id: "not-a-uuid" } }),
      res,
      next,
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Invalid UUID" }),
    );
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});
