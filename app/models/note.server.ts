import type { Book, User } from "@prisma/client";

import { prisma } from "~/db.server";

import { shelfIds } from "./household.server";

// Notes are short: a line or two, not a full review
export const NOTE_MAX_LENGTH = 500;

export function getReaderNotes(bookId: Book["id"]) {
  return prisma.readerNote.findMany({
    where: { bookId, OR: [{ loved: true }, { body: { not: null } }] },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      loved: true,
      body: true,
      updatedAt: true,
      user: {
        select: { id: true, firstname: true, surname: true, profileEmoji: true },
      },
    },
  });
}

// The owner and anyone who has had this copy can leave a note
export async function canLeaveNote(
  userId: User["id"],
  book: { id: string; userId: string; borrowerId: string | null },
) {
  if (book.borrowerId === userId) return true;
  // The owner, or anyone sharing a shelf with them
  if ((await shelfIds(userId)).includes(book.userId)) return true;
  const pastLoan = await prisma.lendingHistory.findFirst({
    where: { bookId: book.id, borrowerId: userId },
    select: { id: true },
  });
  return pastLoan !== null;
}

export async function saveReaderNote(
  userId: User["id"],
  bookId: Book["id"],
  data: { loved?: boolean; body?: string | null },
) {
  const body =
    data.body === undefined
      ? undefined
      : data.body?.trim().slice(0, NOTE_MAX_LENGTH) || null;
  return prisma.readerNote.upsert({
    where: { bookId_userId: { bookId, userId } },
    create: { bookId, userId, loved: data.loved ?? false, body: body ?? null },
    update: { loved: data.loved, body },
  });
}

export function getLoveCounts(bookIds: Book["id"][]) {
  return prisma.readerNote
    .groupBy({
      by: ["bookId"],
      where: { bookId: { in: bookIds }, loved: true },
      _count: { _all: true },
    })
    .then(
      (rows) =>
        new Map(rows.map((row) => [row.bookId, row._count._all] as const)),
    );
}
