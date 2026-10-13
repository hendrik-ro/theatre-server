import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { config } from "../config.js";
import { HttpError } from "../utils/errors.js";

const PG_UNIQUE_VIOLATION = "23505";

function pgErrorCode(err: unknown): string | undefined {
  const withCode = err as { code?: unknown; cause?: { code?: unknown } };
  if (typeof withCode?.code === "string") return withCode.code;
  if (typeof withCode?.cause?.code === "string") return withCode.cause.code;
  return undefined;
}

export const errorHandler: ErrorRequestHandler = (err, _, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof ZodError) {
    res
      .status(400)
      .json({ message: err.issues[0]?.message ?? "Invalid request body" });
    return;
  }

  if (err.type === "entity.too.large") {
    res.status(413).json({ message: "Payload too large" });
    return;
  }

  if (pgErrorCode(err) === PG_UNIQUE_VIOLATION) {
    res.status(409).json({ message: "A movie with this name already exists" });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ message: err.message });
    return;
  }

  console.error(err);

  const message =
    config.env === "production"
      ? "Internal Server Error"
      : err instanceof Error
        ? err.message
        : "Internal Server Error";
  res.status(500).json({ message });
};
