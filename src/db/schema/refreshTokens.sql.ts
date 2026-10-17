import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers.js";
import { users } from "./users.sql.js";

// One row per user: the unique user_id backs the upsert in
// createRefreshToken that rotates the refresh token on login and refresh.
// A presented token only matches while unrevoked and unexpired.
export const refreshTokens = pgTable("refresh_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    // Tokens cannot outlive their user: deleting an account (admin or
    // self-service) cascades so the FK never blocks the delete.
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revoked: boolean("revoked").notNull().default(false),
  ...timestamps,
});
