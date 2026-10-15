import { config } from "../src/config.js";

// The database itself is created once per run by test/globalSetup.ts (see
// there for the local-host safety check). This per-file setup only points
// the shared config at the test database. It reaches db/index.ts because
// that module reads config.dbURL when it first evaluates, which happens
// after this setup file finishes (vitest runs setupFiles before importing
// test modules, and isolation gives each file a fresh module registry).
// Dev and prod are unaffected: every process gets its own config instance,
// so the mutation stays inside the vitest process.

const TEST_DB_NAME = "theatre_test";

const sourceUrl = new URL(process.env.DB_URL ?? "");
const testUrl = new URL(sourceUrl);
testUrl.pathname = `/${TEST_DB_NAME}`;

config.dbURL = testUrl.href;
