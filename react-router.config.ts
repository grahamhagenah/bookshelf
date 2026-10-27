import type { Config } from "@react-router/dev/config";

// BUILD_DIR lets a check build (npm run build:check) land beside the dev
// server's folders instead of in them, which crashed it when both ran
export default {
  ssr: true,
  buildDirectory: process.env.BUILD_DIR || "build",
  // React Router turns away a form post whose origin isn't the request's
  // own. Behind Fly's proxy the request arrives as http while the browser
  // says https, so without this every post on the site was refused. These
  // are our own addresses; posts from anywhere else are still turned away.
  allowedActionOrigins: ["bookstacks.app", "bookshelf-c524.fly.dev"],
} satisfies Config;
