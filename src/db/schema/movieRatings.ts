import { check, integer, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.sql.js";
import { movies } from "./movies.sql.js";
import { timestamps } from "./columns.helpers.js";
import { sql } from "drizzle-orm";

export const movieRatings = pgTable(
  "movie_ratings",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    movieId: uuid("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.movieId] }),
    check(
      "user_movie_ratings_range",
      sql`${table.rating} >= 0 AND ${table.rating} <= 10`,
    ),
  ],
);
