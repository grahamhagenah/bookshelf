import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

// Covers come from Open Library, which answers slowly (two redirects to
// Internet Archive) and is sometimes down. Each cover is fetched once and
// kept on disk.

const UPSTREAM = "https://covers.openlibrary.org";

// Smaller than this and it isn't a picture of anything
export const NO_COVER_BYTES = 200;

// Only Open Library's own cover paths, e.g. b/isbn/9780547928227-M.jpg,
// and covers people pasted a link to, kept here under a hash of that link
export const COVER_PATH =
  /^(b\/(id|isbn|olid)\/[A-Za-z0-9-]+-(S|M|L)\.jpg|custom\/[a-f0-9]{40}\.jpg)$/;

// A pasted cover is fetched once, from a known picture host only (the
// server fetching any address people type would reach into places it
// shouldn't), and no bigger than a cover needs to be
const COVER_HOSTS = [
  /(^|\.)media-amazon\.com$/,
  /(^|\.)ssl-images-amazon\.com$/,
  /(^|\.)images-amazon\.com$/,
  /(^|\.)gr-assets\.com$/,
  /(^|\.)books\.google\.com$/,
  /(^|\.)googleusercontent\.com$/,
  /(^|\.)bookshop\.org$/,
  /(^|\.)wikimedia\.org$/,
  /(^|\.)archive\.org$/,
];
export const COVER_BYTES_MAX = 5 * 1024 * 1024;

export function isOpenLibraryCover(url: string) {
  return url.startsWith("https://covers.openlibrary.org/");
}

// Whether a pasted link is one the server will fetch a cover from
export function coverHostAllowed(url: string) {
  try {
    const { protocol, hostname } = new URL(url);
    return (
      protocol === "https:" && COVER_HOSTS.some((host) => host.test(hostname))
    );
  } catch {
    return false;
  }
}

// Where a pasted cover lives once fetched: its own path under the proxy
export function customCoverPath(url: string) {
  return `custom/${createHash("sha1").update(url).digest("hex")}.jpg`;
}

// Production keeps its data on the Fly volume mounted at /data
const CACHE_DIR =
  process.env.COVER_CACHE_DIR ??
  (process.env.NODE_ENV === "production"
    ? "/data/covers"
    : path.join(os.tmpdir(), "stacks-covers"));

// Several readers can ask for the same new cover at once; fetch it once
const inFlight = new Map<string, Promise<Buffer | null>>();

// Covers asked for by ISBN count against Open Library's rate limit, about
// 100 every five minutes per server, and a shelf of new books goes over it
// at once. Covers asked for by their own ID aren't limited. So an ISBN is
// first turned into its edition's cover ID, once, and the ID remembered.
const isbnIds = new Map<string, number | null>();
const idFileFor = (isbn: string) => path.join(CACHE_DIR, `isbn-id_${isbn}`);

// The cover ID of an ISBN's edition: null when the edition has no
// picture, undefined when Open Library couldn't say
export async function editionCoverId(
  isbn: string,
): Promise<number | null | undefined> {
  if (isbnIds.has(isbn)) return isbnIds.get(isbn);
  const saved = Number(await readFile(idFileFor(isbn), "utf8").catch(() => 0));
  if (saved > 0) {
    isbnIds.set(isbn, saved);
    return saved;
  }
  let id: number | null;
  try {
    const res = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, {
      signal: AbortSignal.timeout(15000),
    });
    // No record of the edition: the cover server has nothing more to go on
    if (!res.ok) return undefined;
    const data = (await res.json()) as { covers?: number[] };
    id = data.covers?.find((cover) => cover > 0) ?? null;
  } catch {
    return undefined;
  }
  // No picture is only remembered until the server restarts, in case one
  // is added; an ID is kept for good
  isbnIds.set(isbn, id);
  if (id) {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(idFileFor(isbn), String(id)).catch(() => undefined);
  }
  return id;
}

// An ISBN cover's address, taken apart; null for any other cover
export function isbnCoverParts(url: string) {
  const match = url.match(
    /^(?:https:\/\/covers\.openlibrary\.org\/)?b\/isbn\/([0-9Xx]+)-([SML])\.jpg$/,
  );
  return match ? { isbn: match[1], size: match[2] } : null;
}

// The same picture by cover ID, where it can be had that way
async function upstreamPath(coverPath: string) {
  const parts = isbnCoverParts(coverPath);
  if (!parts) return coverPath;
  const id = await editionCoverId(parts.isbn);
  if (id === null) return null;
  return id ? `b/id/${id}-${parts.size}.jpg` : coverPath;
}

async function fetchAndStore(coverPath: string, file: string) {
  try {
    const upstream = await upstreamPath(coverPath);
    // The edition has no picture
    if (!upstream) return null;
    const res = await fetch(`${UPSTREAM}/${upstream}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    // An unknown cover comes back as a 1x1 pixel (a few dozen bytes). Not
    // a cover: say so now, and ask again another day
    if (bytes.length < NO_COVER_BYTES) return null;
    await store(file, bytes);
    return bytes;
  } catch {
    return null;
  }
}

const fileFor = (coverPath: string) =>
  path.join(CACHE_DIR, coverPath.replace(/\//g, "_"));

async function store(file: string, bytes: Buffer) {
  // Write then rename, so a half-written file is never served. The bytes
  // are flushed to disk before the rename: otherwise a machine stopped
  // soon after (a deploy) can come back with the file there but empty.
  await mkdir(CACHE_DIR, { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  const handle = await open(temp, "w");
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temp, file);
}

// A kept cover, unless what's on disk is empty or too small to be one
// (left by an earlier machine stop), in which case it's as good as gone
async function readCached(file: string) {
  const bytes = await readFile(file).catch(() => null);
  return bytes && bytes.length >= NO_COVER_BYTES ? bytes : null;
}

// Fetches a pasted cover link once and keeps it, giving back the path to
// serve it from; null when the host isn't one we fetch from, it isn't a
// picture, or it's too big
export async function importCover(url: string): Promise<string | null> {
  if (!coverHostAllowed(url)) return null;
  const coverPath = customCoverPath(url);
  const file = fileFor(coverPath);
  if (await readCached(file)) return `/covers/${coverPath}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
    });
    if (!res.ok || !res.headers.get("content-type")?.startsWith("image/"))
      return null;
    const length = Number(res.headers.get("content-length"));
    if (length > COVER_BYTES_MAX) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length > COVER_BYTES_MAX || bytes.length < NO_COVER_BYTES)
      return null;
    await store(file, bytes);
    return `/covers/${coverPath}`;
  } catch {
    return null;
  }
}

// The cover's bytes, from disk or Open Library; null if it can't be had
export async function loadCover(coverPath: string) {
  if (!COVER_PATH.test(coverPath)) return null;

  const file = fileFor(coverPath);
  const cached = await readCached(file);
  if (cached) return cached;
  // A pasted cover is only ever on disk; there's nowhere else to ask
  if (coverPath.startsWith("custom/")) return null;

  let pending = inFlight.get(coverPath);
  if (!pending) {
    pending = fetchAndStore(coverPath, file).finally(() =>
      inFlight.delete(coverPath),
    );
    inFlight.set(coverPath, pending);
  }
  return pending;
}
