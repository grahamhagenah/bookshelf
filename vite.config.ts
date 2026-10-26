import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// BUILD_DIR lets a check build (npm run build:check) land beside the dev
// server's folders instead of in them, which crashed it when both ran
const buildDirectory = process.env.BUILD_DIR || "build";

export default defineConfig({
  server: { port: 3000 },
  plugins: [
    remix({
      buildDirectory,
      ignoredRouteFiles: ["**/.*", "**/*.test.{ts,tsx}"],
      serverModuleFormat: "cjs",
    }),
    tsconfigPaths(),
  ],
});
