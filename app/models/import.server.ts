import type { User } from "@prisma/client";

import { prisma } from "~/db.server";
import type { ImportRow, ShelfChoice } from "~/import-books";
import { goesOnShelf } from "~/import-books";
import { normalizeTitle, sameWork } from "~/works";

import { shelfIds } from "./household.server";
import { notifyWanters } from "./wish.server";

// Open Library serves covers by ISBN without any lookup; a book with no
// ISBN gets the placeholder until someone edits it
const coverFor = (isbn: string | null) =>
  isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : "";

// Adds the rows to the shelf or the want-to-read list, skipping anything
// already there (in the library, on the list, or earlier in the file)
export async function importBooks(
  userId: User["id"],
  rows: ImportRow[],
  { shelf, wantToRead }: { shelf: ShelfChoice; wantToRead: boolean },
) {
  const [existing, wishes] = await Promise.all([
    prisma.book.findMany({
      where: { userId: { in: await shelfIds(userId) } },
      select: { title: true, openLibraryKey: true, isbn: true },
    }),
    prisma.wantToRead.findMany({
      where: { userId },
      select: { title: true, openLibraryKey: true, isbn: true },
    }),
  ]);
  const seen = new Set<string>();
  const have = [...existing, ...wishes];

  const toShelf: ImportRow[] = [];
  const toList: ImportRow[] = [];
  let skipped = 0;
  for (const row of rows) {
    const key = normalizeTitle(row.title);
    if (seen.has(key) || have.some((book) => sameWork(book, row))) {
      skipped++;
      continue;
    }
    seen.add(key);
    if (goesOnShelf(row, shelf)) toShelf.push(row);
    else if (wantToRead && row.status === "to-read") toList.push(row);
  }

  const now = Date.now();
  // Keep the file's order on the shelf: later rows were added later
  const books = await prisma.$transaction(
    toShelf.map((row, index) =>
      prisma.book.create({
        data: {
          userId,
          title: row.title,
          author: row.author,
          body: "",
          cover: coverFor(row.isbn),
          isbn: row.isbn,
          pageCount: row.pageCount,
          datePublished: row.year,
          publisher: row.publisher,
          // Read, but no date given: as good as today
          readAt:
            row.readAt ?? (row.status === "read" ? row.addedAt ?? new Date() : null),
          createdAt: row.addedAt ?? new Date(now - (toShelf.length - index) * 1000),
        },
        select: { id: true, title: true, openLibraryKey: true, isbn: true },
      }),
    ),
  );
  await prisma.$transaction(
    toList.map((row) =>
      prisma.wantToRead.create({
        data: {
          userId,
          title: row.title,
          author: row.author,
          cover: coverFor(row.isbn),
          isbn: row.isbn,
          createdAt: row.addedAt ?? undefined,
        },
      }),
    ),
  );
  await notifyWanters(userId, books);

  return {
    added: books.length,
    wanted: toList.length,
    skipped,
    bookIds: books.map((book) => book.id),
  };
}
