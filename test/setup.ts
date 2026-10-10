import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const TEST_DB_NAME = "theatre_test";

const sourceUrl = new URL(process.env.DB_URL ?? "");
const host = sourceUrl.hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  throw new Error(
    `Refusing to run tests against non-local host "${host}". ` +
      "Tests drop and recreate a database; they must only target a local Postgres.",
  );
}

const testUrl = new URL(sourceUrl);
testUrl.pathname = `/${TEST_DB_NAME}`;

const admin = postgres(sourceUrl.href, { database: "postgres" });
await admin.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB_NAME} WITH (FORCE)`);
await admin.unsafe(`CREATE DATABASE ${TEST_DB_NAME}`);
await admin.end();

const conn = postgres(testUrl.href);
await migrate(drizzle(conn), {
  migrationsFolder: path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src/db/migrations",
  ),
});
await conn.end();

// Replacing DB_URL for vitest process
// does not affect dev or prod as it is loaded per-process
process.env.DB_URL = testUrl.href;
