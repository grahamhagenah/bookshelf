/// <reference types="vitest" />
/// <reference types="vite/client" />

import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Model tests run against their own SQLite file, rebuilt each run
const TEST_DATABASE_URL = "file:./vitest.db?connection_limit=1";
// And their own cover cache, empty each run: the dev server's cache holds
// real cover IDs that would stand in for the tests' mocked lookups
const TEST_COVER_CACHE_DIR = mkdtempSync(path.join(os.tmpdir(), "stacks-vitest-covers-"));

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./test/setup-test-env.ts"],
    globalSetup: ["./test/global-setup.ts"],
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      COVER_CACHE_DIR: TEST_COVER_CACHE_DIR,
    },
    // One SQLite file, so test files take turns
    fileParallelism: false,
    // The app's own code, not builds or config lying around the project
    coverage: { include: ["app/**"] },
  },
});
