import type { LoaderFunctionArgs } from "@remix-run/node";

import { COVER_PATH, loadCover } from "~/covers.server";

// Serves Open Library covers from this app's own disk cache, with long
// caching, so pages don't wait on Open Library

function contentType(bytes: Buffer) {
  if (bytes.subarray(0, 3).toString("ascii") === "GIF") return "image/gif";
  if (bytes.subarray(1, 4).toString("ascii") === "PNG") return "image/png";
  return "image/jpeg";
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const coverPath = params["*"] ?? "";
  if (!COVER_PATH.test(coverPath)) {
    return new Response("Not found", { status: 404 });
  }

  const bytes = await loadCover(coverPath);
  if (!bytes) {
    // No picture: the browser fires the image's error, the page shows its
    // placeholder, and nothing is remembered, so next time asks again
    return new Response("No cover", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": contentType(bytes),
      "Content-Length": String(bytes.length),
      // A cover at a given path never changes
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
