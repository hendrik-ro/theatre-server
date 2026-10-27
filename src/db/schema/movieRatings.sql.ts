import { check, integer, pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.sql.js";
import { movies } from "./movies.sql.js";
import { timestamps } from "./columns.helpers.js";
import { sql } from "drizzle-orm";

// One rating per user and movie: the composite primary key doubles as
// the conflict target for rateMovie's upsert, so re-rating updates the
// existing row instead of failing the insert. The integer column and
// the 0-10 CHECK keep the rating contract in the database.
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
      sql`${table.rating} >= 1 AND ${table.rating} <= 10`,
    ),
  ],
);
