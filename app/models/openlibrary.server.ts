import type { Book } from "@prisma/client";

import { prisma } from "~/db.server";
import {
  cleanSubjects,
  editionPublisher,
  ENGLISH_EDITION_FIELDS,
  ENGLISH_EDITION_PARAMS,
  englishTitle,
  isLatin,
  readableName,
} from "~/utils";
import type { WithEnglishEdition } from "~/utils";

// Open Library can be slow; never hold a page up for long. A lookup
// someone asked for and is waiting on (picking a cover, opening a book's
// page) gets more patience: its slow days run to ten seconds a call.
const TIMEOUT_MS = 4000;
export const PATIENT_MS = 12000;

// Refresh an author's bio after a month
const AUTHOR_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

async function getJson(url: string, timeoutMs = TIMEOUT_MS) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Open Library answered ${res.status}`);
  return res.json();
}

function textValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "value" in value) {
    const inner = (value as { value: unknown }).value;
    return typeof inner === "string" ? inner : null;
  }
  return null;
}

const ENGLISH_WORDS = new Set(
  "the and of to was is it he she we my his her that for with had what this were they from".split(
    " ",
  ),
);
const OTHER_WORDS = new Set(
  "le la les et des du une est qui dans pour avec au aux nous vous elle der die das und ist nicht ein eine mit von zu el los las y una por con je se na pod".split(
    " ",
  ),
);

// Editions in other languages share the list; keep lines that read as English
function looksEnglish(line: string) {
  const words = line.toLowerCase().match(/[a-z]+/g) ?? [];
  const english = words.filter((word) => ENGLISH_WORDS.has(word)).length;
  const other = words.filter((word) => OTHER_WORDS.has(word)).length;
  const plain = line.replace(/[^\x20-\x7E\u2018-\u201D\u2014]/g, "").length;
  return plain / line.length > 0.97 && english > other;
}

// Editions disagree on the opening line (prefaces, translations, capitals):
// take the English line most editions share
function pickFirstSentence(sentences: unknown): string | null {
  if (!Array.isArray(sentences)) return null;
  const lines = sentences
    .filter((line): line is string => typeof line === "string")
    .map((line) => line.trim())
    .filter((line) => line !== "" && looksEnglish(line));
  const normalize = (line: string) => line.toLowerCase().replace(/[^a-z]/g, "");
  const shouting = (line: string) => {
    const opening = line.slice(0, 12).replace(/[^A-Za-z]/g, "");
    return opening.length > 3 && opening === opening.toUpperCase();
  };

  // A line counts once for every edition that opens with it
  const shared = (line: string) =>
    lines.filter((other) => normalize(other).startsWith(normalize(line)))
      .length;
  const ranked = [...lines].sort(
    (a, b) =>
      shared(b) - shared(a) || Number(shouting(a)) - Number(shouting(b)),
  );
  return ranked[0] ?? null;
}

// Bios often carry Markdown links and "Source" footnotes; keep the prose
function cleanBio(bio: string | null): string | null {
  if (!bio) return null;
  const cleaned = bio
    .replace(/\r/g, "")
    .split("\n")
    // Drop footnote definitions, "Source:" credits and bare links
    .filter(
      (line) =>
        !/^\s*\[\d+\]:/.test(line) &&
        !/^\s*(\*\*)?\(?source/i.test(line) &&
        !/^\s*-*\s*https?:\/\/\S+\s*$/.test(line),
    )
    .join("\n")
    .replace(/\(\[[^\]]*\]\[\d+\]\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\[\d+\]/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .replace(/\s*\(?\bsource\b\)?\.?$/i, "");
  return cleaned || null;
}

async function refreshAuthor(key: string, timeoutMs = TIMEOUT_MS) {
  const existing = await prisma.author.findUnique({ where: { key } });
  // A name saved in another script before names were put into English is
  // looked up again
  if (
    existing &&
    isLatin(existing.name) &&
    Date.now() - existing.updatedAt.getTime() < AUTHOR_MAX_AGE_MS
  ) {
    return;
  }

  const data = await getJson(`https://openlibrary.org/authors/${key}.json`, timeoutMs);
  const links: { url?: string }[] = Array.isArray(data.links) ? data.links : [];
  const wikipedia =
    (typeof data.wikipedia === "string" ? data.wikipedia : null) ??
    links.find((link) => link.url?.includes("wikipedia.org"))?.url ??
    null;
  const author = {
    name: readableName(data),
    bio: cleanBio(textValue(data.bio)),
    birthDate: typeof data.birth_date === "string" ? data.birth_date : null,
    deathDate: typeof data.death_date === "string" ? data.death_date : null,
    wikipedia,
  };
  await prisma.author.upsert({
    where: { key },
    create: { key, ...author },
    update: author,
  });
}

// An author's name in English, for one Open Library gave in another script
// (村上春樹 is Haruki Murakami). Looks the author up once and keeps them;
// gives back the name it was handed if that fails.
export async function englishAuthorName(key: string | null | undefined, name: string) {
  if (!key || isLatin(name)) return name;
  try {
    await refreshAuthor(key);
    const author = await prisma.author.findUnique({ where: { key }, select: { name: true } });
    return author?.name || name;
  } catch {
    return name;
  }
}

// A book saved with its author in another script gets the English name
// when it's opened. Returns the new name, or undefined if nothing changed.
export async function tidyAuthor(book: Pick<Book, "id" | "author" | "authorKey">) {
  if (!book.authorKey || isLatin(book.author)) return undefined;
  const author = await englishAuthorName(book.authorKey, book.author);
  if (author === book.author) return undefined;
  await prisma.book.update({ where: { id: book.id }, data: { author } });
  return author;
}

// Search results with English titles and author names, for showing and
// adding. Each author in another script is looked up once.
export async function inEnglish<
  T extends WithEnglishEdition & { title?: string; author_name?: string[]; author_key?: string[] },
>(docs: T[]): Promise<T[]> {
  const names = new Map<string, Promise<string>>();
  return Promise.all(
    docs.map(async (doc) => {
      const title =
        typeof doc.title === "string" ? englishTitle(doc.title, doc.editions?.docs?.[0]) : doc.title;
      const [first, ...rest] = doc.author_name ?? [];
      const key = doc.author_key?.[0];
      if (!first || !key || isLatin(first)) return { ...doc, title };
      let name = names.get(key);
      if (!name) {
        name = englishAuthorName(key, first);
        names.set(key, name);
      }
      return { ...doc, title, author_name: [await name, ...rest] };
    }),
  );
}

const SEARCH_FIELDS =
  `key,title,author_name,cover_i,first_publish_year,number_of_pages_median,subject,first_sentence,author_key,isbn,${ENGLISH_EDITION_FIELDS}`;

interface Found {
  title: string | null;
  author: string | null;
  key: string | null;
  cover: string | null;
  datePublished: string | null;
  pageCount: number | null;
  subjects: string | null;
  publisher: string | null;
  firstSentence: string | null;
  authorKey: string | null;
  isbn: string | null;
}

// Open Library's best match for a book: by ISBN when there is one, else
// by title and author. Null when it has nothing.
export async function lookupWork(
  book: {
    title: string;
    author: string;
    isbn?: string | null;
    openLibraryKey?: string | null;
  },
  timeoutMs = TIMEOUT_MS,
): Promise<Found | null> {
  const query = book.openLibraryKey
    ? `q=${encodeURIComponent(`key:"${book.openLibraryKey}"`)}`
    : book.isbn
      ? `q=${encodeURIComponent(`isbn:${book.isbn}`)}`
      : `title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}`;
  const data = await getJson(
    `https://openlibrary.org/search.json?${query}&limit=1&${ENGLISH_EDITION_PARAMS}&fields=${SEARCH_FIELDS}`,
    timeoutMs,
  );
  const doc = data.docs?.[0];
  if (!doc) return null;
  const name = doc.author_name?.[0];
  return {
    title: typeof doc.title === "string" ? englishTitle(doc.title, doc.editions?.docs?.[0]) : null,
    author: name ? await englishAuthorName(doc.author_key?.[0], name) : null,
    key: typeof doc.key === "string" ? doc.key : null,
    cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
    datePublished: doc.first_publish_year ? String(doc.first_publish_year) : null,
    pageCount: doc.number_of_pages_median ?? null,
    subjects: cleanSubjects(doc.subject).join(", ") || null,
    publisher: editionPublisher(doc),
    firstSentence: pickFirstSentence(doc.first_sentence),
    authorKey: doc.author_key?.[0] ?? null,
    isbn: Array.isArray(doc.isbn) ? (doc.isbn.find((n: string) => n.length === 13) ?? doc.isbn[0] ?? null) : null,
  };
}

// Every cover Open Library has for a book: the work's own, then its
// editions', newest-listed first. For the owner to pick from. Someone
// clicked for this, so it waits out a slow Open Library; a book whose
// work is known skips the search and asks for the work and its
// editions at once.
export async function findCovers(book: {
  title: string;
  author: string;
  isbn?: string | null;
  openLibraryKey?: string | null;
}) {
  const ids: number[] = [];
  const take = (covers: unknown) => {
    if (!Array.isArray(covers)) return;
    for (const id of covers) if (typeof id === "number" && id > 0) ids.push(id);
  };
  let key = book.openLibraryKey ?? null;

  if (key) {
    const [work, editions] = await Promise.all([
      getJson(`https://openlibrary.org${key}.json`, PATIENT_MS).catch(() => null),
      getJson(`https://openlibrary.org${key}/editions.json?limit=50`, PATIENT_MS).catch(() => null),
    ]);
    if (!work && !editions) throw new Error("Open Library didn't answer");
    take(work?.covers);
    for (const edition of editions?.entries ?? []) take(edition.covers);
  } else {
    const query = book.isbn
      ? `q=${encodeURIComponent(`isbn:${book.isbn}`)}`
      : `title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}`;
    const data = await getJson(`https://openlibrary.org/search.json?${query}&limit=3&fields=key,cover_i`, PATIENT_MS);
    const docs: { key?: string; cover_i?: number }[] = data.docs ?? [];
    for (const doc of docs) if (doc.cover_i) ids.push(doc.cover_i);
    key = docs[0]?.key ?? null;
    if (key) {
      try {
        const editions = await getJson(`https://openlibrary.org${key}/editions.json?limit=50`, PATIENT_MS);
        for (const edition of editions.entries ?? []) take(edition.covers);
      } catch {
        // The search's covers are still something
      }
    }
  }

  return [...new Set(ids)].slice(0, 18).map((id) => ({
    id,
    thumb: `https://covers.openlibrary.org/b/id/${id}-M.jpg`,
    full: `https://covers.openlibrary.org/b/id/${id}-L.jpg`,
  }));
}

// Everything the work page shows about a book that's on no one's shelf
// yet: the search record for it, its description, and its author with
// bio. Null when Open Library doesn't know the key.
// Throws when Open Library didn't answer, which is not the same as not
// knowing the book.
export async function lookupWorkPage(key: string) {
  const found = await lookupWork({ title: "", author: "", openLibraryKey: key }, PATIENT_MS);
  if (!found || !found.title) return null;
  const [description] = await Promise.all([
    fetchDescription(key, PATIENT_MS),
    found.authorKey ? refreshAuthor(found.authorKey, PATIENT_MS).catch(() => undefined) : undefined,
  ]);
  const authorDetails = found.authorKey ? await getAuthor(found.authorKey) : null;
  return { ...found, key, description, authorDetails };
}

// A work's description, which the search results don't carry
export async function fetchDescription(key: string, timeoutMs = TIMEOUT_MS): Promise<string> {
  try {
    const work = await getJson(`https://openlibrary.org${key}.json`, timeoutMs);
    return textValue(work.description) ?? "";
  } catch {
    return "";
  }
}

// Covers by ISBN come straight from Open Library's cover server, which
// answers a blank image when it has none. Ask it to say so instead.
async function coverExists(url: string) {
  try {
    const res = await fetch(`${url}?default=false`, {
      method: "HEAD",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return true;
  }
}

// Fills in whatever a book is missing (cover, description, details, the
// opening line, the author) from Open Library, and remembers it was
// looked up. Leaves what the owner already has alone.
export async function fillInBook(bookId: Book["id"], timeoutMs = TIMEOUT_MS) {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: {
      id: true,
      title: true,
      author: true,
      cover: true,
      body: true,
      isbn: true,
      openLibraryKey: true,
      datePublished: true,
      pageCount: true,
      subjects: true,
      publisher: true,
    },
  });
  if (!book) return;

  try {
    const found = await lookupWork(book, timeoutMs);
    const key = book.openLibraryKey ?? found?.key ?? null;
    // The description and the author don't depend on each other
    const [description] = await Promise.all([
      !book.body && key ? fetchDescription(key, timeoutMs) : "",
      found?.authorKey ? refreshAuthor(found.authorKey, timeoutMs) : undefined,
    ]);

    // A cover made from the ISBN may be blank; swap it for the work's
    let cover = book.cover;
    if (found?.cover && (!cover || (cover.includes("/b/isbn/") && !(await coverExists(cover))))) {
      cover = found.cover;
    }

    await prisma.book.update({
      where: { id: book.id },
      data: {
        cover,
        body: book.body || description,
        openLibraryKey: key,
        isbn: book.isbn ?? found?.isbn ?? null,
        datePublished: book.datePublished ?? found?.datePublished ?? null,
        pageCount: book.pageCount ?? found?.pageCount ?? null,
        subjects: book.subjects ?? found?.subjects ?? null,
        publisher: book.publisher ?? found?.publisher ?? null,
        firstSentence: found?.firstSentence ?? null,
        authorKey: found?.authorKey ?? null,
        detailsFetchedAt: new Date(),
      },
    });
  } catch {
    // Open Library unreachable or slow; leave it for the next visit
  }
}

// After an import: fill in the new books a few at a time, in the
// background, so the import itself stays quick
export async function fillInBooks(bookIds: Book["id"][], concurrency = 3) {
  const queue = [...bookIds];
  const worker = async () => {
    for (let id = queue.shift(); id; id = queue.shift()) {
      await fillInBook(id);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}

// Looks up a book's details once, then remembers it. Failures are quiet:
// the page shows what it has and tries again next time.
// A book's first look-up, started by its page and finished in the
// background, so the page never waits on Open Library. A second visit
// while it's under way joins the first rather than starting another.
const filling = new Map<string, Promise<void>>();

export function fillInBookOnce(bookId: Book["id"]) {
  let pending = filling.get(bookId);
  if (!pending) {
    pending = fillInBook(bookId, PATIENT_MS).finally(() => filling.delete(bookId));
    filling.set(bookId, pending);
  }
  return pending;
}

export async function ensureBookDetails(
  book: Pick<Book, "id" | "detailsFetchedAt">,
  { force = false } = {},
) {
  if (book.detailsFetchedAt && !force) return;
  await fillInBook(book.id);
}

export function getAuthor(key: string | null) {
  if (!key) return null;
  return prisma.author.findUnique({ where: { key } });
}
