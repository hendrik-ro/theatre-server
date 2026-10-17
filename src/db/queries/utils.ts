import { HttpError } from "../../utils/errors.js";
import { config } from "../../config.js";

export function firstOrUndefined<T>(items: T[]) {
  if (items.length === 0) {
    return;
  }
  return items[0];
}

// Test-support reset helpers must never run against a real environment.
export function isDevOrTest(): boolean {
  return config.env === "development" || config.env === "test";
}

type UUID = string & { __brand: "uuid" };

export function isUUID(s: string): s is UUID {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s,
  );
}

export function assertUUID(id: string): void {
  if (!isUUID(id)) throw new HttpError(400, "Invalid UUID");
}
