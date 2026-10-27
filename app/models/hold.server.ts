import { prisma } from "~/db.server";
import type { Book, User } from "~/generated/prisma/client";
import { isNotLending } from "~/lending";

import { createBookRequestNotification } from "./user.server";

// Holds: friends waiting in line for a book that's out on loan. When it
// comes back, the person at the front is asked for automatically.

// Everyone waiting, first in line first
export function getHolds(bookId: Book["id"]) {
  return prisma.hold.findMany({
    where: { bookId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          firstname: true,
          surname: true,
          profileEmoji: true,
        },
      },
    },
  });
}

// Join the line; joining twice keeps your original place
export async function placeHold(bookId: Book["id"], userId: User["id"]) {
  return prisma.hold.upsert({
    where: { bookId_userId: { bookId, userId } },
    create: { bookId, userId },
    update: {},
  });
}

export function leaveHold(bookId: Book["id"], userId: User["id"]) {
  return prisma.hold.deleteMany({ where: { bookId, userId } });
}

// The book is back: turn the first hold into a borrow request to the
// owner, and tell that reader it's their turn. Returns the request so the
// caller can let a demo owner answer it.
export async function passToNextInLine(bookId: Book["id"]) {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: {
      id: true,
      title: true,
      borrowerId: true,
      notLendingUntil: true,
      user: { select: { id: true, firstname: true, surname: true } },
    },
  });
  if (!book || book.borrowerId) return null;
  // Not lending it for now: the line keeps its place for when it is
  if (isNotLending(book.notLendingUntil)) return null;

  const next = await prisma.hold.findFirst({
    where: { bookId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      user: { select: { id: true, firstname: true, surname: true } },
    },
  });
  if (!next) return null;

  await prisma.hold.delete({ where: { id: next.id } });
  const request = await createBookRequestNotification(
    next.user.id,
    book.user.id,
    `${next.user.firstname} ${next.user.surname}`,
    book.id,
    book.title,
  );
  await prisma.notification.create({
    data: {
      type: "HOLD_READY",
      senderId: book.user.id,
      receiverId: next.user.id,
      senderName: `${book.user.firstname} ${book.user.surname}`,
      bookId: book.id,
      bookTitle: book.title,
    },
  });
  return request;
}
