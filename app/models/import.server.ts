import { prisma } from "~/db.server";
import type { User, WorkNote } from "~/generated/prisma/client";
import type { ImportRow, ShelfChoice } from "~/import-books";
import { goesOnAlsoRead, goesOnShelf } from "~/import-books";
import { roomForBooks } from "~/plan.server";
import { normalizeTitle, sameWork } from "~/works";


import { shelfIds } from "./household.server";
import { lookupWork } from "./openlibrary.server";
import { notifyWanters } from "./wish.server";
import { adoptWorkNotes } from "./work-note.server";

// Open Library serves covers by ISBN without any lookup; a book with no
// ISBN gets the placeholder until someone edits it
const coverFor = (isbn: string | null) =>
  isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg` : "";

// Until Open Library is asked which work it is, a book read elsewhere is
// kept under its ISBN or its title and author
export const IMPORTED_KEY_PREFIX = "import:";
const importedKey = (row: ImportRow) =>
  `${IMPORTED_KEY_PREFIX}${row.isbn ? `isbn:${row.isbn}` : `title:${normalizeTitle(row.title)}|${normalizeTitle(row.author)}`}`;
export const isbnFromImportedKey = (key: string) =>
  key.startsWith(`${IMPORTED_KEY_PREFIX}isbn:`)
    ? key.slice(IMPORTED_KEY_PREFIX.length + "isbn:".length)
    : null;

// Read, but no date given: as good as today
const readDate = (row: ImportRow) =>
  row.readAt ?? (row.status === "read" ? row.addedAt ?? new Date() : null);
// A note or heart brought over is dated when they read the book (or put it
// on their list there), so years of reviews don't arrive in friends' feeds
// as today's news
const noteDate = (row: ImportRow) =>
  row.readAt ?? row.addedAt ?? new Date(0);
const isLoved = (row: ImportRow) => (row.rating ?? 0) >= 5;
const hasNote = (row: ImportRow) => isLoved(row) || row.review !== null;

// Adds the rows to the shelf, the Also read list or the want-to-read list,
// skipping anything already there (in the library, on a list, or earlier
// in the file). Reviews come along as notes, five stars as hearts. On the
// free plan the shelf fills to its limit, the books marked owned first,
// and the rest wait; the lists have no limit.
export async function importBooks(
  userId: User["id"],
  rows: ImportRow[],
  {
    shelf,
    wantToRead,
    alsoRead = true,
  }: { shelf: ShelfChoice; wantToRead: boolean; alsoRead?: boolean },
) {
  const [existing, wishes, noted] = await Promise.all([
    prisma.book.findMany({
      where: { userId: { in: await shelfIds(userId) } },
      select: { title: true, openLibraryKey: true, isbn: true },
    }),
    prisma.wantToRead.findMany({
      where: { userId },
      select: { title: true, openLibraryKey: true, isbn: true },
    }),
    prisma.workNote.findMany({
      where: { userId },
      select: { id: true, title: true, workKey: true, loved: true, body: true, readAt: true },
    }),
  ]);
  const seen = new Set<string>();
  const have = [...existing, ...wishes];
  // Their Also read list, as works to compare against
  const notedWorks = noted.map((note) => ({
    ...note,
    openLibraryKey: note.workKey.startsWith("/works/") ? note.workKey : null,
    isbn: isbnFromImportedKey(note.workKey),
  }));

  const toShelf: ImportRow[] = [];
  const toAlsoRead: ImportRow[] = [];
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
    else if (alsoRead && goesOnAlsoRead(row, shelf)) {
      if (notedWorks.some((note) => sameWork(note, row))) skipped++;
      else toAlsoRead.push(row);
    } else if (wantToRead && row.status === "to-read") toList.push(row);
  }

  // What fits on a free shelf: the books they own first, then the rest,
  // each in the file's order
  const room = await roomForBooks(userId);
  const overLimit = Math.max(0, toShelf.length - room);
  if (overLimit) {
    const fits = new Set(
      [...toShelf.filter((row) => row.owned), ...toShelf.filter((row) => !row.owned)].slice(0, room),
    );
    toShelf.splice(0, toShelf.length, ...toShelf.filter((row) => fits.has(row)));
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
          readAt: readDate(row),
          createdAt: row.addedAt ?? new Date(now - (toShelf.length - index) * 1000),
        },
        select: { id: true, title: true, openLibraryKey: true, isbn: true },
      }),
    ),
  );

  // Their review and stars, on their copy. A book on their Also read
  // list that's now on the shelf brings its note along and leaves the list.
  await prisma.$transaction(
    books.flatMap((book, index) => {
      const row = toShelf[index];
      const listed = notedWorks.find((note) => sameWork(note, row));
      if (!hasNote(row) && !listed) return [];
      const at = noteDate(row);
      return [
        prisma.readerNote.create({
          data: {
            bookId: book.id,
            userId,
            loved: isLoved(row) || (listed?.loved ?? false),
            body: row.review ?? listed?.body ?? null,
            readAt: readDate(row) ?? listed?.readAt ?? null,
            createdAt: at,
            updatedAt: at,
          },
        }),
        ...(listed ? [prisma.workNote.delete({ where: { id: listed.id } })] : []),
      ];
    }),
  );

  // Read somewhere else: on the Also read list, with their review and
  // stars, until Open Library says which work each is (see
  // findImportedWorks)
  await prisma.$transaction(
    toAlsoRead.map((row) => {
      const at = noteDate(row);
      return prisma.workNote.create({
        data: {
          userId,
          workKey: importedKey(row),
          title: row.title,
          author: row.author,
          cover: coverFor(row.isbn),
          loved: isLoved(row),
          body: row.review,
          readAt: readDate(row),
          createdAt: at,
          updatedAt: at,
        },
      });
    }),
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
    alsoRead: toAlsoRead.length,
    wanted: toList.length,
    skipped,
    overLimit,
    bookIds: books.map((book) => book.id),
  };
}

// Books read elsewhere come in under a stand-in key. Each is looked up on
// Open Library a few at a time, in the background, and given its work's
// key, so it opens the work's page and sits with everyone else's notes on
// it. One Open Library can't place yet keeps its stand-in and is tried
// again the next time the list is opened. A lookup already under way for
// someone is joined, not repeated.
const finding = new Map<string, Promise<void>>();

export function findImportedWorks(userId: User["id"]) {
  let pending = finding.get(userId);
  if (!pending) {
    pending = findEach(userId).finally(() => finding.delete(userId));
    finding.set(userId, pending);
  }
  return pending;
}

async function findEach(userId: User["id"], concurrency = 3) {
  const queue = await prisma.workNote.findMany({
    where: { userId, workKey: { startsWith: IMPORTED_KEY_PREFIX } },
  });
  const worker = async () => {
    for (let note = queue.shift(); note; note = queue.shift()) {
      const found = await lookupWork({
        title: note.title,
        author: note.author,
        isbn: isbnFromImportedKey(note.workKey),
      }).catch(() => null);
      if (found?.key?.startsWith("/works/")) await placeNote(note, found.key, found.cover);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}

// The note takes its work's key, keeping its date so it doesn't turn up
// in feeds as new. Already noted under that work: the two become one.
// A copy of the work on their shelf takes the note, as when a book noted
// elsewhere is added.
async function placeNote(
  note: WorkNote,
  workKey: string,
  cover: string | null,
) {
  const already = await prisma.workNote.findUnique({
    where: { userId_workKey: { userId: note.userId, workKey } },
  });
  if (already) {
    await prisma.$transaction([
      prisma.workNote.update({
        where: { id: already.id },
        data: {
          loved: already.loved || note.loved,
          body: already.body ?? note.body,
          readAt: already.readAt ?? note.readAt,
          updatedAt: already.updatedAt,
        },
      }),
      prisma.workNote.delete({ where: { id: note.id } }),
    ]);
  } else {
    await prisma.workNote.update({
      where: { id: note.id },
      data: { workKey, cover: note.cover || cover || "", updatedAt: note.updatedAt },
    });
  }
  const copy = await prisma.book.findFirst({
    where: { openLibraryKey: workKey, userId: { in: await shelfIds(note.userId) } },
    select: { id: true },
  });
  if (copy) await adoptWorkNotes(copy.id);
}

// A pasted list's lines that are only an ISBN: Open Library's title and
// author for each, a few at a time. The ones it doesn't know come back
// unfound, to say so.
export async function findListIsbns(rows: ImportRow[], concurrency = 5) {
  const unfound: string[] = [];
  const queue = rows.filter((row) => !row.title && row.isbn);
  const worker = async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      const found = await lookupWork({ title: "", author: "", isbn: row.isbn }).catch(() => null);
      if (found?.title) {
        row.title = found.title;
        row.author = found.author ?? "";
      } else if (row.isbn) {
        unfound.push(row.isbn);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { rows: rows.filter((row) => row.title), unfound };
}
