import { pgTable, text } from "drizzle-orm/pg-core";

export const appBootstrap = pgTable("app_bootstrap", {
  key: text().primaryKey(),
});
