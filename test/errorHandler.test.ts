import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { z } from "zod";

vi.mock("../src/config.js", () => ({
  config: { env: "development" },
}));

import { config } from "../src/config.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { HttpError } from "../src/utils/errors.js";
import { movieInputSchema } from "../src/models/movies.js";

const req = {} as Request;

function makeResponse(headersSent = false) {
  const res = {
    headersSent,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  return res as unknown as Response;
}

function zodError(): z.ZodError {
  const result = movieInputSchema.safeParse({ name: "", year: 9999 });
  if (!result.success) return result.error;
  throw new Error("expected parse failure");
}

beforeEach(() => {
  config.env = "development";
});

describe("errorHandler", () => {
  it("maps a ZodError to 400 with the first issue message", () => {
    const res = makeResponse();
    errorHandler(zodError(), req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: expect.any(String),
    });
  });

  it("maps a unique constraint violation to 409", () => {
    const res = makeResponse();
    const err = Object.assign(new Error("duplicate key"), { code: "23505" });
    errorHandler(err, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "A movie with this name already exists",
    });
  });

  it("maps a unique violation nested in cause to 409", () => {
    const res = makeResponse();
    const err = new Error("drizzle wrapper", {
      cause: Object.assign(new Error("duplicate key"), { code: "23505" }),
    });
    errorHandler(err, req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("honors the status of an HttpError", () => {
    const res = makeResponse();
    errorHandler(new HttpError(400, "Invalid UUID"), req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid UUID" });
  });

  it("returns the error message outside production", () => {
    const res = makeResponse();
    errorHandler(new Error("db down"), req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "db down" });
  });

  it("hides the error message in production", () => {
    config.env = "production";
    const res = makeResponse();
    errorHandler(new Error("secret internals"), req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });

  it("defers to next when the response has already started", () => {
    const res = makeResponse(true);
    const next = vi.fn();
    const err = new Error("late failure");
    errorHandler(err, req, res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});
