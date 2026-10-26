import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { CACHE_DIR, loadCover } from "~/covers.server";
import { prisma } from "~/db.server";

import { lookupWork } from "./openlibrary.server";

// The demo's books carry Open Library covers by ISBN, and Open Library
// has no picture for many of those exact editions: it answers a blank,
// and the shelf fills with placeholders. So each demo ISBN is checked
// once, in the background, and where it's blank the work's own cover
// (found by title and author) is used instead. The answers are kept on
// disk beside the covers, so every later sandbox starts with them.

export interface DemoCoverBook {
  isbn: string;
  title: string;
  author: string;
}

const FILE = path.join(CACHE_DIR, "demo-covers.json");
const UPSTREAM = "https://covers.openlibrary.org/";

export const isbnCover = (isbn: string) => `${UPSTREAM}b/isbn/${isbn}-L.jpg`;

// isbn -> the cover to use
let known: Record<string, string> | null = null;

async function load() {
  if (!known) {
    known = await readFile(FILE, "utf8")
      .then((text) => JSON.parse(text) as Record<string, string>)
      .catch(() => ({}));
  }
  return known;
}

async function save(covers: Record<string, string>) {
  await mkdir(CACHE_DIR, { recursive: true });
  const temp = `${FILE}.${process.pid}.tmp`;
  await writeFile(temp, JSON.stringify(covers, null, 1));
  await rename(temp, FILE);
}

// The cover a new demo book gets: the one found to work, else by ISBN
export async function demoCover(isbn: string) {
  return (await load())[isbn] ?? isbnCover(isbn);
}

// Whether the picture is real, fetching it into the cover cache if so
const hasPicture = async (url: string) =>
  Boolean(await loadCover(url.slice(UPSTREAM.length)));

async function resolve(book: DemoCoverBook): Promise<string | null> {
  const byIsbn = isbnCover(book.isbn);
  if (await hasPicture(byIsbn)) return byIsbn;
  const found = await lookupWork({
    title: book.title,
    author: book.author,
  }).catch(() => null);
  if (found?.cover && (await hasPicture(found.cover))) return found.cover;
  // Open Library had nothing, or didn't answer: ask again another time
  return null;
}

let running: Promise<void> | null = null;
let lastRun = 0;
const RETRY_MS = 60 * 60 * 1000;

// Checks the demo's covers not yet known, a few at a time, and moves the
// books already in sandboxes onto the working ones. Runs at most once
// an hour per server, and not at all once every cover is known.
export function resolveDemoCovers(books: DemoCoverBook[]) {
  if (running || Date.now() - lastRun < RETRY_MS) return running;
  lastRun = Date.now();
  running = (async () => {
    const covers = await load();
    const queue = books.filter(
      (book, i) =>
        !covers[book.isbn] &&
        books.findIndex((other) => other.isbn === book.isbn) === i,
    );
    if (queue.length === 0) return;

    const worker = async () => {
      for (let book = queue.shift(); book; book = queue.shift()) {
        const cover = await resolve(book);
        if (!cover) continue;
        covers[book.isbn] = cover;
        const stale = isbnCover(book.isbn);
        if (cover === stale) continue;
        const inDemo = { cover: stale, user: { demoGroup: { not: null } } };
        await prisma.book.updateMany({ where: inDemo, data: { cover } });
        await prisma.wantToRead.updateMany({ where: inDemo, data: { cover } });
      }
    };
    await Promise.all(Array.from({ length: 3 }, worker));
    await save(covers);
  })()
    .catch(() => undefined)
    .finally(() => {
      running = null;
    });
  return running;
}
