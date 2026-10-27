import { pgTable, uuid, text, integer } from "drizzle-orm/pg-core";
import { timestamps } from "./columns.helpers.js";

export const movies = pgTable("movies", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  ...timestamps,
  name: text("name").notNull().unique(),
  year: integer("year"),
  runtime: integer("runtime"),
  genre: text("genre"),
});
