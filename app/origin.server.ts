import { SITE_URL } from "~/seo";

// The address to put in links people share. Behind Fly's proxy requests
// arrive as plain http, so production always uses the site's https address.
export function publicOrigin(request: Request) {
  return process.env.NODE_ENV === "production"
    ? SITE_URL
    : new URL(request.url).origin;
}
