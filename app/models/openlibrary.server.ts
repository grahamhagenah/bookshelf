import type { Book } from "@prisma/client";

import { prisma } from "~/db.server";
import { cleanSubjects } from "~/utils";

// Open Library can be slow; never hold a page up for long
const TIMEOUT_MS = 4000;

// Refresh an author's bio after a month
const AUTHOR_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

async function getJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
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

async function refreshAuthor(key: string) {
  const existing = await prisma.author.findUnique({ where: { key } });
  if (
    existing &&
    Date.now() - existing.updatedAt.getTime() < AUTHOR_MAX_AGE_MS
  ) {
    return;
  }

  const data = await getJson(`https://openlibrary.org/authors/${key}.json`);
  const links: { url?: string }[] = Array.isArray(data.links) ? data.links : [];
  const wikipedia =
    (typeof data.wikipedia === "string" ? data.wikipedia : null) ??
    links.find((link) => link.url?.includes("wikipedia.org"))?.url ??
    null;
  const author = {
    name: typeof data.name === "string" ? data.name : "",
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

const SEARCH_FIELDS =
  "key,title,author_name,cover_i,first_publish_year,number_of_pages_median,subject,publisher,first_sentence,author_key,isbn";

interface Found {
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
export async function lookupWork(book: {
  title: string;
  author: string;
  isbn?: string | null;
  openLibraryKey?: string | null;
}): Promise<Found | null> {
  const query = book.openLibraryKey
    ? `q=${encodeURIComponent(`key:"${book.openLibraryKey}"`)}`
    : book.isbn
      ? `q=${encodeURIComponent(`isbn:${book.isbn}`)}`
      : `title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}`;
  const data = await getJson(
    `https://openlibrary.org/search.json?${query}&limit=1&fields=${SEARCH_FIELDS}`,
  );
  const doc = data.docs?.[0];
  if (!doc) return null;
  return {
    key: typeof doc.key === "string" ? doc.key : null,
    cover: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
    datePublished: doc.first_publish_year ? String(doc.first_publish_year) : null,
    pageCount: doc.number_of_pages_median ?? null,
    subjects: cleanSubjects(doc.subject).join(", ") || null,
    publisher: doc.publisher?.[0] ?? null,
    firstSentence: pickFirstSentence(doc.first_sentence),
    authorKey: doc.author_key?.[0] ?? null,
    isbn: Array.isArray(doc.isbn) ? (doc.isbn.find((n: string) => n.length === 13) ?? doc.isbn[0] ?? null) : null,
  };
}

// A work's description, which the search results don't carry
export async function fetchDescription(key: string): Promise<string> {
  try {
    const work = await getJson(`https://openlibrary.org${key}.json`);
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
export async function fillInBook(bookId: Book["id"]) {
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
    const found = await lookupWork(book);
    const key = book.openLibraryKey ?? found?.key ?? null;
    const description = !book.body && key ? await fetchDescription(key) : "";
    if (found?.authorKey) await refreshAuthor(found.authorKey);

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
