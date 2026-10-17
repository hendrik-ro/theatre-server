import { and, eq, gt } from "drizzle-orm";
import { db } from "../index.js";
import { refreshTokens } from "../schema/refreshTokens.sql.js";
import { assertUUID, firstOrUndefined } from "./utils.js";

// Upsert on user_id: rotating a refresh token (login or refresh) replaces
// the single row, so the previously issued token stops matching and is
// effectively revoked.
export async function createRefreshToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  assertUUID(userId);
  await db
    .insert(refreshTokens)
    .values({ userId, tokenHash, expiresAt })
    .onConflictDoUpdate({
      target: refreshTokens.userId,
      set: { tokenHash, expiresAt, revoked: false },
    });
}

// Returns the owning user id only while the token is active: revoked or
// expired rows never match, so a replayed stolen token refreshes nothing.
export async function getUserIdByRefreshToken(
  hash: string,
): Promise<string | undefined> {
  const row = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.tokenHash, hash),
        eq(refreshTokens.revoked, false),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    );
  return firstOrUndefined(row)?.userId;
}

export async function revokeRefreshToken(userId: string): Promise<void> {
  assertUUID(userId);
  await db
    .update(refreshTokens)
    .set({ revoked: true })
    .where(eq(refreshTokens.userId, userId));
}
