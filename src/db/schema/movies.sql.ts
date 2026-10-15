import {
  pgTable,
  uuid,
  text,
  integer,
  numeric,
  check,
} from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers.js";
import { sql } from "drizzle-orm";

export const movies = pgTable(
  "movies",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    ...timestamps,
    name: text("name").notNull().unique(),
    year: integer("year"),
    runtime: integer("runtime"),
    imdbRating: numeric("imdb_rating", {
      precision: 3,
      scale: 1,
      mode: "number",
    }),
    genre: text("genre"),
  },
  (table) => [
    check(
      "imdb_rating_range",
      sql`${table.imdbRating} >= 0 AND ${table.imdbRating} <= 10`,
    ),
  ],
);
