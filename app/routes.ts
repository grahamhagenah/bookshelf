import type { RouteConfig } from "@react-router/dev/routes";
import { flatRoutes } from "@react-router/fs-routes";

// Every file in app/routes is a page, named the Remix way, as before;
// tests beside them aren't
export default flatRoutes({
  ignoredRouteFiles: ["**/.*", "**/*.test.{ts,tsx}"],
}) satisfies RouteConfig;
