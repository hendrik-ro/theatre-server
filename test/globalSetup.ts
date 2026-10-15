import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { config } from "../src/config.js";

const TEST_DB_NAME = "theatre_test";

// Runs once per vitest run (not per test file): create a fresh test
// database and apply all migrations. Per-file isolation is preserved by
// vitest itself; each test file resets the tables it touches in its
// beforeEach.
export default async function setupTestDatabase() {
  // config.dbURL is the parsed DB_URL from the repo .env (loaded by the
  // config import). Raw process.env reads proved unreliable in vitest's
  // globalSetup module runner.
  const sourceUrl = new URL(config.dbURL);
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
}
