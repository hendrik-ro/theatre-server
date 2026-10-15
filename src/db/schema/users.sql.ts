import {
  check,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers.js";
import { sql } from "drizzle-orm";

export const userRole = pgEnum("user_role", ["user", "admin"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    ...timestamps,
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    username: text("username").notNull().unique(),
    email: text("email").notNull().unique(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("user"),
  },
  (table) => [
    check("users_email_lowercase", sql`${table.email} = lower(${table.email})`),
  ],
);
