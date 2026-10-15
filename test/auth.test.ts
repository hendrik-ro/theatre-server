import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/auth/hash.js";

describe("hash", () => {
  const password = "testpassword1000";

  it("matching hash and password return true", async () => {
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash!);

    expect(hash).toBeTypeOf("string");
    expect(isValid).toBe(true);
  });

  it("unmatched hash and password return false", async () => {
    const hash = await hashPassword(password);
    const isValid = await verifyPassword("nottestpw", hash!);

    expect(hash).toBeTypeOf("string");
    expect(isValid).toBe(false);
  });
});
