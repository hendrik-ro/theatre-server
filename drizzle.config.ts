import { defineConfig } from "drizzle-kit";
import { config } from "./src/config";

export default defineConfig({
  schema: "./src/db/schema",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: config.dbURL,
  },
});
