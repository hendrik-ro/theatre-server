import { pgTable, timestamp, uuid, text, integer } from "drizzle-orm/pg-core";

export const movies = pgTable("movies", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  name: text("name").notNull().unique(),
  year: integer("year"),
  runtime: integer("runtime"),
  imdb_rating: integer("imdb_rating"),
  genre: text("genre"),
});
