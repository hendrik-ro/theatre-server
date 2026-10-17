import argon2 from "argon2";
import { createHash } from "node:crypto";

// Refresh tokens are stored hashed so a database leak does not yield
// reusable credentials. Unlike passwords, tokens are high-entropy secrets:
// there is nothing to brute-force, so a fast unsalted hash is the right
// tool — argon2's cost here would buy nothing but latency on every
// login and refresh.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string | null> {
  try {
    const hash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64MB
      timeCost: 3, // 3 iterations
      parallelism: 4, // 4 threads
    });
    return hash;
  } catch (err) {
    console.error("Error hashing password: ", err);
    return null;
  }
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean | null> {
  try {
    const isValid = await argon2.verify(hash, password);
    return isValid;
  } catch (err) {
    console.error("Error verifying password: ", err);
    return null;
  }
}
