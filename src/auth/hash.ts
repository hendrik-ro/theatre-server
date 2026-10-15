import argon2 from "argon2";

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
