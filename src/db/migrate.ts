import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { config } from "../config.js";

// Runtime migration runner for the production image, where drizzle-kit
// (a devDependency) is not installed: the same SQL migrations drizzle-kit
// generates, applied through the production drizzle-orm migrator.
// Resolved from the process cwd — the repo root in dev, /app in the
// container; both keep the folder at src/db/migrations.
const MIGRATIONS_FOLDER = "src/db/migrations";

async function main() {
  const conn = postgres(config.dbURL, { max: 1 });
  const db = drizzle(conn);
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  await conn.end();
  console.log("Migrations applied");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
