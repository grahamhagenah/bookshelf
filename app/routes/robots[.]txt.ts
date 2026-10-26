import { robotsTxt } from "~/seo";

export const loader = () =>
  new Response(robotsTxt(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
