import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    // Creates and migrates the test database once per run instead of once
    // per file (previously ~40% of suite time).
    globalSetup: ["test/globalSetup.ts"],
    fileParallelism: false,
  },
});
