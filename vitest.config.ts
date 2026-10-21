/// <reference types="vitest" />
/// <reference types="vite/client" />

import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

// Model tests run against their own SQLite file, rebuilt each run
const TEST_DATABASE_URL = "file:./vitest.db?connection_limit=1";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: "happy-dom",
    setupFiles: ["./test/setup-test-env.ts"],
    globalSetup: ["./test/global-setup.ts"],
    env: { DATABASE_URL: TEST_DATABASE_URL },
    // One SQLite file, so test files take turns
    singleThread: true,
  },
});
