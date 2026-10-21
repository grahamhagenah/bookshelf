import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { LoaderFunctionArgs } from "@remix-run/node";

// Covers come from Open Library, which answers slowly (two redirects to
// Internet Archive) and is sometimes down. This route fetches each cover
// once, keeps it on disk, and serves it from here with long caching.

const UPSTREAM = "https://covers.openlibrary.org";

// Only Open Library's own cover paths, e.g. b/isbn/9780547928227-M.jpg
const COVER_PATH = /^b\/(id|isbn|olid)\/[A-Za-z0-9-]+-(S|M|L)\.jpg$/;

// Production keeps its data on the Fly volume mounted at /data
const CACHE_DIR =
  process.env.COVER_CACHE_DIR ??
  (process.env.NODE_ENV === "production"
    ? "/data/covers"
    : path.join(os.tmpdir(), "stacks-covers"));

// Several readers can ask for the same new cover at once; fetch it once
const inFlight = new Map<string, Promise<Buffer | null>>();

function contentType(bytes: Buffer) {
  if (bytes.subarray(0, 3).toString("ascii") === "GIF") return "image/gif";
  if (bytes.subarray(1, 4).toString("ascii") === "PNG") return "image/png";
  return "image/jpeg";
}

async function fetchAndStore(coverPath: string, file: string) {
  try {
    const res = await fetch(`${UPSTREAM}/${coverPath}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    // Write then rename, so a half-written file is never served
    await mkdir(CACHE_DIR, { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, bytes);
    await rename(temp, file);
    return bytes;
  } catch {
    return null;
  }
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  const coverPath = params["*"] ?? "";
  if (!COVER_PATH.test(coverPath)) {
    return new Response("Not found", { status: 404 });
  }

  const file = path.join(CACHE_DIR, coverPath.replace(/\//g, "_"));
  let bytes = await readFile(file).catch(() => null);

  if (!bytes) {
    let pending = inFlight.get(coverPath);
    if (!pending) {
      pending = fetchAndStore(coverPath, file).finally(() =>
        inFlight.delete(coverPath),
      );
      inFlight.set(coverPath, pending);
    }
    bytes = await pending;
  }

  if (!bytes) {
    // Let the page fall back to its placeholder, and try again next time
    return new Response("Cover unavailable", {
      status: 502,
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
