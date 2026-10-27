import type { Config } from "@react-router/dev/config";

// BUILD_DIR lets a check build (npm run build:check) land beside the dev
// server's folders instead of in them, which crashed it when both ran
export default {
  ssr: true,
  buildDirectory: process.env.BUILD_DIR || "build",
  // React Router 8's behavior, ahead of moving to it
  future: {
    v8_middleware: true,
    v8_splitRouteModules: true,
    v8_viteEnvironmentApi: true,
    v8_passThroughRequests: true,
    v8_trailingSlashAwareDataRequests: true,
  },
} satisfies Config;
