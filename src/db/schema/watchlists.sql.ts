import { pgTable, primaryKey, uuid } from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers.js";
import { users } from "./users.sql.js";
import { movies } from "./movies.sql.js";

export const watchlists = pgTable(
  "watchlists",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    movieId: uuid("movie_id")
      .notNull()
      .references(() => movies.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (table) => [primaryKey({ columns: [table.userId, table.movieId] })],
);
