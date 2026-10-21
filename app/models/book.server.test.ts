// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import {
  DEFAULT_LOAN_WEEKS,
  EXTEND_WEEKS,
  extendLoan,
  getHomeBooks,
  lendBook,
  loanWeeks,
  returnBook,
} from "./book.server";

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

async function lentBook(weeks = 4) {
  const owner = await makeUser("Owner");
  const borrower = await makeUser("Borrower");
  const book = await makeBook(owner.id);
  await lendBook(book.id, borrower.id, weeks);
  return { owner, borrower, book };
}

function reminder(type: string, bookId: string, receiverId: string, senderId: string) {
  return prisma.notification.create({
    data: { type, bookId, receiverId, senderId, senderName: "Owner Reader" },
  });
}

describe("loanWeeks", () => {
  test("accepts only the offered lengths", () => {
    expect(loanWeeks("2")).toBe(2);
    expect(loanWeeks(8)).toBe(8);
    expect(loanWeeks("5")).toBe(DEFAULT_LOAN_WEEKS);
    expect(loanWeeks("lots")).toBe(DEFAULT_LOAN_WEEKS);
    expect(loanWeeks(null)).toBe(DEFAULT_LOAN_WEEKS);
  });

  test("checks extensions against their own list", () => {
    expect(loanWeeks("4", EXTEND_WEEKS)).toBe(4);
    expect(loanWeeks("8", EXTEND_WEEKS)).toBe(DEFAULT_LOAN_WEEKS);
  });
});

describe("lendBook", () => {
  test("hands the book over with a due date and records the loan", async () => {
    const before = Date.now();
    const { borrower, book } = await lentBook(2);

    const updated = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(updated.borrowerId).toBe(borrower.id);
    expect(updated.lendCount).toBe(1);
    const due = updated.dueDate!.getTime() - updated.borrowedAt!.getTime();
    expect(due).toBe(2 * WEEK);
    expect(updated.borrowedAt!.getTime()).toBeGreaterThanOrEqual(before);

    const history = await prisma.lendingHistory.findMany({ where: { bookId: book.id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ borrowerId: borrower.id, returnedAt: null });
  });
});

describe("extendLoan", () => {
  test("adds weeks to the current due date", async () => {
    const { book } = await lentBook(2);
    const { dueDate } = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });

    const extended = await extendLoan(book.id, 1);
    expect(extended!.dueDate!.getTime() - dueDate!.getTime()).toBe(WEEK);
  });

  test("counts from today when the book is already overdue", async () => {
    const { book } = await lentBook(2);
    await prisma.book.update({
      where: { id: book.id },
      data: { dueDate: new Date(Date.now() - 10 * DAY) },
    });

    const before = Date.now();
    const extended = await extendLoan(book.id, 1);
    expect(extended!.dueDate!.getTime()).toBeGreaterThanOrEqual(before + WEEK);
    expect(extended!.dueDate!.getTime()).toBeLessThan(before + WEEK + DAY);
  });

  test("puts away the borrower's due reminders", async () => {
    const { owner, borrower, book } = await lentBook(2);
    await reminder("OVERDUE_REMINDER", book.id, borrower.id, owner.id);
    await reminder("DUE_SOON_REMINDER", book.id, borrower.id, owner.id);

    await extendLoan(book.id, 2);

    const unread = await prisma.notification.count({
      where: { bookId: book.id, receiverId: borrower.id, read: false },
    });
    expect(unread).toBe(0);
  });

  test("does nothing for a book that isn't lent out", async () => {
    const owner = await makeUser("Owner");
    const book = await makeBook(owner.id);
    expect(await extendLoan(book.id, 1)).toBeNull();
  });
});

describe("returnBook", () => {
  test("puts the book back on the shelf and closes the loan", async () => {
    const { owner, borrower, book } = await lentBook();
    await reminder("OVERDUE_REMINDER", book.id, borrower.id, owner.id);

    await returnBook(book.id);

    const updated = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(updated).toMatchObject({ borrowerId: null, borrowedAt: null, dueDate: null });
    // The loan still counts toward the book's history
    expect(updated.lendCount).toBe(1);

    const history = await prisma.lendingHistory.findFirstOrThrow({
      where: { bookId: book.id },
    });
    expect(history.returnedAt).not.toBeNull();

    const dismissed = await prisma.notification.findFirstOrThrow({
      where: { bookId: book.id, type: "OVERDUE_REMINDER" },
    });
    expect(dismissed).toMatchObject({ read: true, actionTaken: "dismissed" });
  });

  test("closes only the latest loan when a book has been lent before", async () => {
    const { book } = await lentBook();
    await returnBook(book.id);
    const second = await makeUser("Second");
    await lendBook(book.id, second.id);
    await returnBook(book.id);

    const history = await prisma.lendingHistory.findMany({
      where: { bookId: book.id },
      orderBy: { borrowedAt: "asc" },
    });
    expect(history).toHaveLength(2);
    expect(history.every((loan) => loan.returnedAt !== null)).toBe(true);
    const updated = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(updated.lendCount).toBe(2);
  });
});

describe("getHomeBooks", () => {
  test("sorts your books into borrowed, lent out and on the shelf", async () => {
    const me = await makeUser("Me");
    const friend = await makeUser("Friend");
    const later = await makeBook(me.id, "Due later");
    const sooner = await makeBook(me.id, "Due sooner");
    await makeBook(me.id, "At home");
    const theirs = await makeBook(friend.id, "Theirs");

    await lendBook(later.id, friend.id, 4);
    await lendBook(sooner.id, friend.id, 1);
    await lendBook(theirs.id, me.id, 2);
    // Created a day apart, so "newest" is unambiguous
    for (const [days, title] of [
      [3, "Due later"],
      [2, "Due sooner"],
      [1, "At home"],
    ] as const) {
      await prisma.book.updateMany({
        where: { userId: me.id, title },
        data: { createdAt: new Date(Date.now() - days * DAY) },
      });
    }

    const home = await getHomeBooks(me.id);
    expect(home.borrowed.map((book) => [book.title, book.owner.firstname])).toEqual([
      ["Theirs", "Friend"],
    ]);
    // Soonest due first
    expect(home.lent.map((book) => book.title)).toEqual(["Due sooner", "Due later"]);
    expect(home.lent[0].borrower?.firstname).toBe("Friend");
    expect(home.shelf.map((book) => book.title)).toEqual(["At home"]);
    // Newest first, whether or not they're lent out
    expect(home.recent.map((book) => book.title)).toEqual([
      "At home",
      "Due sooner",
      "Due later",
    ]);
  });
});
