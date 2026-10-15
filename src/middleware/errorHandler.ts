import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { config } from "../config.js";
import { HttpError } from "../utils/errors.js";

const PG_UNIQUE_VIOLATION = "23505";

// Maps the violated Postgres constraint name to a user-facing message.
// Constraint names come from the drizzle schema; adding a unique column
// there means adding its message here.
const UNIQUE_VIOLATION_MESSAGES: Record<string, string> = {
  movies_name_unique: "A movie with this name already exists",
  users_username_unique: "This username is already taken",
  users_email_unique: "An account with this email already exists",
};

function pgErrorCode(err: unknown): string | undefined {
  const withCode = err as { code?: unknown; cause?: { code?: unknown } };
  if (typeof withCode?.code === "string") return withCode.code;
  if (typeof withCode?.cause?.code === "string") return withCode.cause.code;
  return undefined;
}

// postgres-js surfaces the Postgres "n" error field (constraint name) as
// constraint_name, unlike node-postgres which uses "constraint".
function pgErrorConstraint(err: unknown): string | undefined {
  const withConstraint = err as {
    constraint_name?: unknown;
    cause?: { constraint_name?: unknown };
  };
  if (typeof withConstraint?.constraint_name === "string")
    return withConstraint.constraint_name;
  if (typeof withConstraint?.cause?.constraint_name === "string")
    return withConstraint.cause.constraint_name;
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

  if (err.type === "entity.parse.failed") {
    res.status(400).json({ message: "Invalid JSON body" });
    return;
  }

  if (pgErrorCode(err) === PG_UNIQUE_VIOLATION) {
    const constraint = pgErrorConstraint(err);
    res.status(409).json({
      message:
        (constraint && UNIQUE_VIOLATION_MESSAGES[constraint]) ??
        "This value is already in use",
    });
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
