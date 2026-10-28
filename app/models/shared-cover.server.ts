import { isOpenLibraryCover } from "~/covers.server";
import { prisma } from "~/db.server";
import { isbnForms } from "~/isbn";

// Open Library's covers are often small or the wrong edition, and people
// replace them. A replacement is shared: every other copy of the same book
// that still has Open Library's cover gets it too, and so does anyone who
// adds that book later. A cover someone picked themselves is never
// replaced.

interface BookKeys {
  isbn?: string | null;
  openLibraryKey?: string | null;
}

// An edition goes by both ways of writing its ISBN
const isbnKeys = (isbn: string | null | undefined) =>
  isbn ? isbnForms(isbn).map((form) => `isbn:${form}`) : [];
const isWorkKey = (key: string | null | undefined): key is string =>
  !!key && /^\/works\/OL\d+W$/.test(key);

// Open Library's own cover, or none: what a shared cover may stand in for
export const replaceable = (cover: string | null | undefined) =>
  !cover || isOpenLibraryCover(cover);

// The cover someone picked for this book, by its edition first, then its
// work; null when nobody has
export async function sharedCoverFor({ isbn, openLibraryKey }: BookKeys) {
  const keys = [
    ...isbnKeys(isbn),
    ...(isWorkKey(openLibraryKey) ? [openLibraryKey] : []),
  ];
  if (!keys.length) return null;
  const found = await prisma.sharedCover.findMany({ where: { key: { in: keys } } });
  for (const key of keys) {
    const shared = found.find((row) => row.key === key);
    if (shared) return shared.cover;
  }
  return null;
}

// Covers people picked, for a page of search results, by work key
export async function sharedCoversForWorks(keys: (string | undefined)[]) {
  const works = keys.filter(isWorkKey);
  if (!works.length) return {};
  const found = await prisma.sharedCover.findMany({ where: { key: { in: works } } });
  return Object.fromEntries(found.map((row) => [row.key, row.cover]));
}

// The cover to keep for a book: the one given, unless that's only Open
// Library's and someone has picked a better one
export async function withSharedCover<T extends string | null>(
  cover: T,
  book: BookKeys,
): Promise<T | string> {
  if (!replaceable(cover)) return cover;
  return (await sharedCoverFor(book)) ?? cover;
}

// Someone picked a cover for one of their books by hand: remember it for
// the book, and give it to every other copy, wish and note of the same
// book still showing Open Library's. Demo sandboxes keep theirs to
// themselves.
export async function shareCover(
  bookId: string,
  cover: string,
  userId: string,
) {
  if (!cover) return;
  const [book, user] = await Promise.all([
    prisma.book.findUnique({
      where: { id: bookId },
      select: { isbn: true, openLibraryKey: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { demoGroup: true } }),
  ]);
  if (!book || !user || user.demoGroup) return;

  const workKey = isWorkKey(book.openLibraryKey) ? book.openLibraryKey : null;
  const isbns = book.isbn ? isbnForms(book.isbn) : [];
  const keys = [...(workKey ? [workKey] : []), ...isbnKeys(book.isbn)];
  if (!keys.length) return;

  await prisma.$transaction(
    keys.map((key) =>
      prisma.sharedCover.upsert({
        where: { key },
        create: { key, cover, userId },
        update: { cover, userId },
      }),
    ),
  );

  const stillOpenLibrary = {
    OR: [{ cover: "" }, { cover: { startsWith: "https://covers.openlibrary.org/" } }],
  };
  // Copies known by their work, then any of this edition that aren't
  const sameBook = [
    ...(workKey ? [{ openLibraryKey: workKey }] : []),
    ...(isbns.length ? [{ isbn: { in: isbns } }] : []),
  ];
  for (const where of sameBook) {
    await prisma.book.updateMany({
      where: { id: { not: bookId }, ...where, ...stillOpenLibrary },
      data: { cover },
    });
    await prisma.wantToRead.updateMany({
      where: { ...where, ...stillOpenLibrary },
      data: { cover },
    });
  }
  if (workKey) {
    await prisma.workNote.updateMany({
      where: { workKey, ...stillOpenLibrary },
      data: { cover },
    });
  }
}
