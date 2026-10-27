import { prisma } from "~/db.server";
import type { Book, User } from "~/generated/prisma/client";
import { isNotLending } from "~/lending";

import { DEFAULT_LOAN_WEEKS, lendToFriend, returnBook } from "./book.server";
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

// The borrower hands the book straight to whoever's first in line, as a
// book club does, without it going back to the owner in between. The loan
// ends and the next one starts for the usual length, and both the owner
// and the new borrower hear who passed it to whom. Not while the owner
// has stopped lending: then it goes back to them. Null when there's no
// one to pass it to.
export async function passStraightOn(bookId: Book["id"], borrowerId: User["id"]) {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: {
      id: true,
      title: true,
      userId: true,
      borrowerId: true,
      notLendingUntil: true,
      user: { select: { firstname: true } },
      borrower: { select: { firstname: true, surname: true } },
    },
  });
  if (!book || book.borrowerId !== borrowerId || !book.borrower) return null;
  if (isNotLending(book.notLendingUntil)) return null;

  const next = await prisma.hold.findFirst({
    where: { bookId },
    orderBy: { createdAt: "asc" },
    select: { id: true, user: { select: { id: true, firstname: true, surname: true } } },
  });
  if (!next) return null;

  const passer = `${book.borrower.firstname} ${book.borrower.surname}`.trim();
  const to = `${next.user.firstname} ${next.user.surname}`.trim();
  await prisma.hold.delete({ where: { id: next.id } });
  await returnBook(bookId);
  await lendToFriend(bookId, book.userId, next.user.id, DEFAULT_LOAN_WEEKS);
  await prisma.notification.createMany({
    data: [
      // To the one who has it now: who it's from, and whose it is
      {
        type: "BOOK_PASSED",
        senderId: borrowerId,
        receiverId: next.user.id,
        senderName: passer,
        bookId,
        bookTitle: book.title,
        message: book.user.firstname,
      },
      // To the owner: where their book's gone
      {
        type: "BOOK_PASSED_ON",
        senderId: borrowerId,
        receiverId: book.userId,
        senderName: passer,
        bookId,
        bookTitle: book.title,
        message: to,
      },
    ],
  });
  return { to: next.user };
}
