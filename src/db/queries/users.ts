import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { users } from "../schema/users.sql.js";
import { assertUUID, firstOrUndefined } from "./utils.js";
import { User } from "../../models/users.js";
import { config } from "../../config.js";
import { appBootstrap } from "../schema/appBootstrap.sql.js";
import { firstAdmin } from "./bootstrap.js";

export async function getAllUsers(): Promise<User[]> {
  const result = await db.select().from(users);
  return result;
}

export async function createUser(
  username: string,
  email: string,
  passwordHash: string,
): Promise<User> {
  // The claim and the insert must commit together: if the insert fails
  // (duplicate username or email), the transaction rolls the claim back
  // so the next registration can still bootstrap the first admin.
  return db.transaction(async (tx) => {
    const claimed = await firstAdmin(tx);
    const role = claimed.length === 1 ? "admin" : "user";
    const [newUser] = await tx
      .insert(users)
      .values({
        username,
        email: email.toLowerCase(),
        passwordHash,
        role,
      })
      .returning();
    return newUser;
  });
}

export async function deleteUser(id: string): Promise<void> {
  assertUUID(id);
  await db.delete(users).where(eq(users.id, id));
}

export async function getUserByUsername(
  username: string,
): Promise<User | undefined> {
  const user = await db
    .select()
    .from(users)
    .where(eq(users.username, username));
  return firstOrUndefined(user);
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const user = await db.select().from(users).where(eq(users.email, email));
  return firstOrUndefined(user);
}

export async function getUserById(id: string): Promise<User | undefined> {
  assertUUID(id);
  const user = await db.select().from(users).where(eq(users.id, id));
  return firstOrUndefined(user);
}

export async function setLastLogin(id: string): Promise<void> {
  assertUUID(id);
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, id));
}

export async function resetUsers(): Promise<void> {
  if (!["development", "test"].includes(config.env)) return;
  await db.delete(users);
  await db.delete(appBootstrap);
}

export async function changeRole(
  id: string,
  newRole: "user" | "admin",
): Promise<User> {
  assertUUID(id);
  const [user] = await db
    .update(users)
    .set({ role: newRole })
    .where(eq(users.id, id))
    .returning();
  return user;
}
