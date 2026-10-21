import type { Book } from "@prisma/client";

import { prisma } from "~/db.server";

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

// Looks up a book's opening sentence and author once, then remembers it.
// Failures are quiet: the page shows what it has and tries again next time.
export async function ensureBookDetails(
  book: Pick<
    Book,
    "id" | "title" | "author" | "openLibraryKey" | "detailsFetchedAt"
  >,
  { force = false } = {},
) {
  if (book.detailsFetchedAt && !force) return;

  // Books added by hand have no work key, so match on title and author
  const query = book.openLibraryKey
    ? `q=${encodeURIComponent(`key:"${book.openLibraryKey}"`)}`
    : `title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}`;

  try {
    const data = await getJson(
      `https://openlibrary.org/search.json?${query}&limit=1&fields=key,first_sentence,author_key`,
    );
    const doc = data.docs?.[0];
    const authorKey: string | null = doc?.author_key?.[0] ?? null;

    if (authorKey) await refreshAuthor(authorKey);

    await prisma.book.update({
      where: { id: book.id },
      data: {
        firstSentence: pickFirstSentence(doc?.first_sentence),
        authorKey,
        detailsFetchedAt: new Date(),
      },
    });
  } catch {
    // Open Library unreachable or slow; leave it for the next visit
  }
}

export function getAuthor(key: string | null) {
  if (!key) return null;
  return prisma.author.findUnique({ where: { key } });
}
