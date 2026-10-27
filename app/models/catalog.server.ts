import { prisma } from "~/db.server";
import { cleanSubjects, editionPublisher } from "~/utils";

// Every book Stacks has come across, by Open Library work: what's on a
// shelf or wanted, and what Open Library's searches turn up. It answers
// the search box at once, while Open Library is still being asked.

export interface CatalogEntry {
  key: string;
  title: string;
  author: string | null;
  coverId: number | null;
  year: number | null;
  pages: number | null;
  subjects: string | null;
  publisher: string | null;
  editions: number | null;
}

// An Open Library search result as the catalog keeps it, once its title
// and author are in English. Null without a work key or title.
// Open Library's results are loosely typed, as they always were here
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromSearchResult(doc: Record<string, any>): CatalogEntry | null {
  if (typeof doc.key !== "string" || typeof doc.title !== "string") return null;
  return {
    key: doc.key,
    title: doc.title,
    author: typeof doc.author_name?.[0] === "string" ? doc.author_name[0] : null,
    coverId: typeof doc.cover_i === "number" ? doc.cover_i : null,
    year:
      typeof doc.first_publish_year === "number" ? doc.first_publish_year : null,
    pages:
      typeof doc.number_of_pages_median === "number"
        ? doc.number_of_pages_median
        : null,
    subjects: cleanSubjects(doc.subject).join(", ") || null,
    publisher: editionPublisher(doc),
    editions: typeof doc.edition_count === "number" ? doc.edition_count : null,
  };
}

export function rememberSearchResults(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  docs: Record<string, any>[],
) {
  return rememberBooks(
    docs.map(fromSearchResult).filter((entry) => entry !== null),
  );
}

// Keeps what's new about these books. A detail one source leaves out
// (a quick search has no publisher) doesn't wipe one another gave.
// Never in the way: a failure here is only a book not remembered.
export async function rememberBooks(entries: CatalogEntry[]) {
  const works = entries.filter(
    (entry) => entry.key.startsWith("/works/") && entry.title.trim(),
  );
  if (works.length === 0) return;
  try {
    await prisma.$transaction(
      works.map((entry) => {
        const known = Object.fromEntries(
          Object.entries(entry).filter(([, value]) => value !== null),
        );
        return prisma.catalogBook.upsert({
          where: { key: entry.key },
          create: entry,
          update: known,
        });
      }),
    );
  } catch {
    // Remembered next time
  }
}

// Books whose title or author holds every typed word, the most widely
// read first. Rough on purpose: the caller checks each word starts a word.
export async function catalogCandidates(typed: string[], limit = 50) {
  if (typed.length === 0) return [];
  return prisma.catalogBook.findMany({
    where: {
      AND: typed.map((word) => ({
        OR: [{ title: { contains: word } }, { author: { contains: word } }],
      })),
    },
    orderBy: [
      { editions: { sort: "desc", nulls: "last" } },
      { updatedAt: "desc" },
    ],
    take: limit,
  });
}

// Of these works, the ones someone in Stacks has a copy of
export async function onShelves(keys: string[]) {
  if (keys.length === 0) return new Set<string>();
  const copies = await prisma.book.findMany({
    where: { openLibraryKey: { in: keys } },
    select: { openLibraryKey: true },
    distinct: ["openLibraryKey"],
  });
  return new Set(copies.map((copy) => copy.openLibraryKey as string));
}
