import type session from "express-session";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const sessions = pgTable(
  "sessions",
  {
    sid: text("sid").primaryKey(),
    sess: jsonb("sess").$type<session.SessionData>().notNull(),
    expire: timestamp("expire", { withTimezone: true }).notNull(),
  },
  (table) => [index("sessions_expire_idx").on(table.expire)],
);
