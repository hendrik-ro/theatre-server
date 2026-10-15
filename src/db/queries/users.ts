import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { users } from "../schema/users.sql.js";
import { assertUUID, firstOrUndefined } from "./utils.js";
import { User } from "../../models/users.js";
import { config } from "../../config.js";

export async function getAllUsers(): Promise<User[]> {
  const result = await db.select().from(users);
  return result;
}

export async function createUser(
  username: string,
  email: string,
  passwordHash: string,
  role: "user" | "admin" = "user",
): Promise<User> {
  const [newUser] = await db
    .insert(users)
    .values({
      username,
      email: email.toLowerCase(),
      passwordHash,
      role,
    })
    .returning();
  return newUser;
}

export async function deleteUser(id: string): Promise<void> {
  assertUUID(id);
  await db.delete(users).where(eq(users.id, id));
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
