/* eslint-env node */
// BUILD_DIR lets a check build (npm run build:check) land beside the dev
// server's folders instead of in them, which crashed it when both ran
const dir = process.env.BUILD_DIR || "build";

/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  cacheDirectory: "./node_modules/.cache/remix",
  ignoredRouteFiles: ["**/.*", "**/*.test.{ts,tsx}"],
  serverModuleFormat: "cjs",
  serverBuildPath: `${dir}/index.js`,
  assetsBuildDirectory: `public/${dir}`,
  publicPath: `/${dir}/`,
};
