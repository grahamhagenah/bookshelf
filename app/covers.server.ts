import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Covers come from Open Library, which answers slowly (two redirects to
// Internet Archive) and is sometimes down. Each cover is fetched once and
// kept on disk.

const UPSTREAM = "https://covers.openlibrary.org";

// Smaller than this and it isn't a picture of anything
export const NO_COVER_BYTES = 200;

// Only Open Library's own cover paths, e.g. b/isbn/9780547928227-M.jpg
export const COVER_PATH = /^b\/(id|isbn|olid)\/[A-Za-z0-9-]+-(S|M|L)\.jpg$/;

// Production keeps its data on the Fly volume mounted at /data
const CACHE_DIR =
  process.env.COVER_CACHE_DIR ??
  (process.env.NODE_ENV === "production"
    ? "/data/covers"
    : path.join(os.tmpdir(), "stacks-covers"));

// Several readers can ask for the same new cover at once; fetch it once
const inFlight = new Map<string, Promise<Buffer | null>>();

async function fetchAndStore(coverPath: string, file: string) {
  try {
    const res = await fetch(`${UPSTREAM}/${coverPath}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    // An unknown cover comes back as a 1x1 pixel (a few dozen bytes). Not
    // a cover: say so now, and ask again another day
    if (bytes.length < NO_COVER_BYTES) return null;
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

// The cover's bytes, from disk or Open Library; null if it can't be had
export async function loadCover(coverPath: string) {
  if (!COVER_PATH.test(coverPath)) return null;

  const file = path.join(CACHE_DIR, coverPath.replace(/\//g, "_"));
  const cached = await readFile(file).catch(() => null);
  if (cached) return cached;

  let pending = inFlight.get(coverPath);
  if (!pending) {
    pending = fetchAndStore(coverPath, file).finally(() =>
      inFlight.delete(coverPath),
    );
    inFlight.set(coverPath, pending);
  }
  return pending;
}
