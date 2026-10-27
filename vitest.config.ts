/// <reference types="vitest" />
/// <reference types="vite/client" />

import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Model tests run against their own SQLite file, rebuilt each run
const TEST_DATABASE_URL = "file:./vitest.db";
// And their own cover cache, empty each run: the dev server's cache holds
// real cover IDs that would stand in for the tests' mocked lookups
const TEST_COVER_CACHE_DIR = mkdtempSync(path.join(os.tmpdir(), "stacks-vitest-covers-"));

export default defineConfig({
  plugins: [react()],
  // "~/..." imports, from tsconfig.json
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    // Every test sits beside the code it checks
    include: ["app/**/*.test.{ts,tsx}"],
    environment: "happy-dom",
    setupFiles: ["./test/setup-test-env.ts"],
    globalSetup: ["./test/global-setup.ts"],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      COVER_CACHE_DIR: TEST_COVER_CACHE_DIR,
      // Signing sessions and links needs a secret; CI has no .env, and
      // each test file runs on its own, so every one gets it here
      SESSION_SECRET: "test-secret",
    },
    // One SQLite file, so test files take turns
    fileParallelism: false,
    // The app's own code, not builds or config lying around the project
    coverage: { include: ["app/**"] },
  },
});
