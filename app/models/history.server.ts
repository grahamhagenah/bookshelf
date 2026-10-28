import { prisma } from "~/db.server";
import type { User } from "~/generated/prisma/client";


import { getBookStats } from "./book.server";
import { shelfIds } from "./household.server";

// Every loan you've been part of, newest first: books you borrowed from
// friends (with your note on each, so you can come back and leave one)
// and your own books you lent out (with what the borrower thought)

const bookFields = {
  id: true,
  title: true,
  author: true,
  cover: true,
} as const;
const person = {
  select: { id: true, firstname: true, surname: true },
} as const;

export async function getHistory(userId: User["id"]) {
  const myShelf = await shelfIds(userId);
  const [borrowed, lent] = await Promise.all([
    // Only loans that are over: ones still out are on your shelf and the
    // home page already
    prisma.lendingHistory.findMany({
      where: { borrowerId: userId, returnedAt: { not: null } },
      select: {
        id: true,
        borrowedAt: true,
        returnedAt: true,
        book: {
          select: {
            ...bookFields,
            user: person,
            readerNotes: {
              where: { userId },
              select: { body: true, loved: true },
            },
          },
        },
      },
    }),
    prisma.lendingHistory.findMany({
      where: { book: { userId: { in: myShelf } }, returnedAt: { not: null } },
      select: {
        id: true,
        borrowedAt: true,
        returnedAt: true,
        borrower: person,
        book: {
          select: {
            ...bookFields,
            readerNotes: { select: { userId: true, body: true, loved: true } },
          },
        },
      },
    }),
  ]);

  const entries = [
    ...borrowed.map(
      ({
        id,
        borrowedAt,
        returnedAt,
        book: { user, readerNotes, ...book },
      }) => ({
        id,
        kind: "borrowed" as const,
        borrowedAt,
        returnedAt,
        book,
        // Whose it is
        person: user,
        note: readerNotes[0] ?? null,
      }),
    ),
    ...lent.map(
      ({
        id,
        borrowedAt,
        returnedAt,
        borrower,
        book: { readerNotes, ...book },
      }) => ({
        id,
        kind: "lent" as const,
        borrowedAt,
        returnedAt,
        book,
        // Who had it
        person: borrower,
        note: readerNotes.find((note) => note.userId === borrower.id) ?? null,
      }),
    ),
  ];
  // The most recently back first
  return entries.sort(
    (a, b) =>
      (b.returnedAt ?? b.borrowedAt).getTime() - (a.returnedAt ?? a.borrowedAt).getTime(),
  );
}

// The numbers on the tabs above your library, want-to-read list and history
export async function getShelfCounts(userId: User["id"]) {
  const myShelf = await shelfIds(userId);
  const [stats, want, elsewhere, borrowed, lent] = await Promise.all([
    getBookStats(userId, myShelf),
    prisma.wantToRead.count({ where: { userId } }),
    prisma.workNote.count({ where: { userId } }),
    // History is loans that are over, as its page lists them
    prisma.lendingHistory.count({ where: { borrowerId: userId, returnedAt: { not: null } } }),
    prisma.lendingHistory.count({
      where: { book: { userId: { in: myShelf } }, returnedAt: { not: null } },
    }),
  ]);
  return {
    // As the library counts it: your shelf and what you've borrowed
    library: stats.totalBooks + stats.borrowedBooks,
    want,
    elsewhere,
    history: borrowed + lent,
  };
}
