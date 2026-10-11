import { sql } from "drizzle-orm";
import {
  pgTable,
  timestamp,
  uuid,
  text,
  integer,
  numeric,
  check,
} from "drizzle-orm/pg-core";

const MAX_YEAR = new Date().getFullYear() + 1;

export const movies = pgTable(
  "movies",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    name: text("name").notNull().unique(),
    year: integer("year"),
    runtime: integer("runtime"),
    imdbRating: numeric("imdb_rating", { mode: "number" }),
    genre: text("genre"),
  },
  (table) => [
    check(
      "movies_year_range",
      sql`${table.year} is null or ${table.year} between 1750 and ${MAX_YEAR}`,
    ),
    check(
      "movies_runtime_range",
      sql`${table.runtime} is null or ${table.runtime} between 1 and 9999`,
    ),
    check(
      "movies_imdb_rating_range",
      sql`${table.imdbRating} is null or ${table.imdbRating} between 0 and 10`,
    ),
  ],
);
