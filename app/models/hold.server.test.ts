// @vitest-environment node
import { NOT_LENDING_FOREVER } from "~/lending";

import { makeBook, makeUser, prisma } from "../../test/db";

import {
  lendBook,
  returnBook,
  setNotLending,
  UNDO_RETURN_DAYS,
  undoableReturn,
  undoReturn,
} from "./book.server";
import {
  getHolds,
  leaveHold,
  passStraightOn,
  passToNextInLine,
  placeHold,
} from "./hold.server";

async function lentBook() {
  const owner = await makeUser("Olive");
  const borrower = await makeUser("Sam");
  const book = await makeBook(owner.id, "Piranesi");
  await lendBook(book.id, borrower.id);
  return { owner, borrower, book };
}

test("holds queue in the order people joined, once each", async () => {
  const { book } = await lentBook();
  const maya = await makeUser("Maya");
  const priya = await makeUser("Priya");

  await placeHold(book.id, maya.id);
  await placeHold(book.id, priya.id);
  // Joining again keeps Maya's place at the front
  await placeHold(book.id, maya.id);

  const holds = await getHolds(book.id);
  expect(holds.map((hold) => hold.user.firstname)).toEqual(["Maya", "Priya"]);

  await leaveHold(book.id, maya.id);
  expect((await getHolds(book.id)).map((hold) => hold.user.firstname)).toEqual([
    "Priya",
  ]);
});

describe("passToNextInLine", () => {
  test("asks the owner for the first in line and tells them it's their turn", async () => {
    const { owner, book } = await lentBook();
    const maya = await makeUser("Maya");
    const priya = await makeUser("Priya");
    await placeHold(book.id, maya.id);
    await placeHold(book.id, priya.id);

    await returnBook(book.id);
    const request = await passToNextInLine(book.id);

    expect(request).toMatchObject({ senderId: maya.id, receiverId: owner.id });
    const ready = await prisma.notification.findFirstOrThrow({
      where: { type: "HOLD_READY", receiverId: maya.id },
    });
    expect(ready).toMatchObject({ senderId: owner.id, bookId: book.id });
    // Maya has left the line; Priya is now first
    expect(
      (await getHolds(book.id)).map((hold) => hold.user.firstname),
    ).toEqual(["Priya"]);
  });

  test("does nothing while the book is still out, or with nobody waiting", async () => {
    const { book } = await lentBook();
    const maya = await makeUser("Maya");
    await placeHold(book.id, maya.id);

    expect(await passToNextInLine(book.id)).toBeNull();
    expect(await getHolds(book.id)).toHaveLength(1);

    await leaveHold(book.id, maya.id);
    await returnBook(book.id);
    expect(await passToNextInLine(book.id)).toBeNull();
  });
});

test("getting the book clears your own hold", async () => {
  const { book } = await lentBook();
  const maya = await makeUser("Maya");
  await placeHold(book.id, maya.id);

  await returnBook(book.id);
  await lendBook(book.id, maya.id);

  expect(await getHolds(book.id)).toHaveLength(0);
});

test("a book back while its owner isn't lending keeps its line until they are", async () => {
  const { book } = await lentBook();
  const maya = await makeUser("Maya");
  await placeHold(book.id, maya.id);

  await setNotLending(book.id, NOT_LENDING_FOREVER);
  await returnBook(book.id);
  expect(await passToNextInLine(book.id)).toBeNull();
  expect((await getHolds(book.id)).map((hold) => hold.user.firstname)).toEqual([
    "Maya",
  ]);

  await setNotLending(book.id, null);
  expect(await passToNextInLine(book.id)).toMatchObject({ senderId: maya.id });
});

describe("undoReturn", () => {
  test("puts the loan back as it was and tells the borrower", async () => {
    const { owner, borrower, book } = await lentBook();
    const before = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
    await prisma.notification.create({
      data: {
        type: "BOOK_RETURNED",
        senderId: borrower.id,
        receiverId: owner.id,
        senderName: "Sam",
        bookId: book.id,
        bookTitle: book.title,
      },
    });
    await returnBook(book.id);

    expect(await undoReturn(book.id, { id: owner.id, name: "Olive" })).toEqual({
      borrowerId: borrower.id,
    });
    const after = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
    expect(after.borrowerId).toBe(borrower.id);
    expect(after.borrowedAt).toEqual(before.borrowedAt);
    expect(after.dueDate).toEqual(before.dueDate);
    const history = await prisma.lendingHistory.findMany({ where: { bookId: book.id } });
    expect(history).toHaveLength(1);
    expect(history[0].returnedAt).toBeNull();

    const told = await prisma.notification.findFirstOrThrow({
      where: { type: "RETURN_UNDONE", receiverId: borrower.id },
    });
    expect(told).toMatchObject({ senderId: owner.id, bookId: book.id });
    const returned = await prisma.notification.findFirstOrThrow({
      where: { type: "BOOK_RETURNED", bookId: book.id },
    });
    expect(returned.actionTaken).toBe("undone");
  });

  test("whoever it was handed on to goes back to the front of the line", async () => {
    const { owner, book } = await lentBook();
    const maya = await makeUser("Maya");
    const priya = await makeUser("Priya");
    await placeHold(book.id, maya.id);
    await placeHold(book.id, priya.id);
    await returnBook(book.id);
    await passToNextInLine(book.id);

    await undoReturn(book.id, { id: owner.id, name: "Olive" });

    expect(
      (await getHolds(book.id)).map((hold) => hold.user.firstname),
    ).toEqual(["Maya", "Priya"]);
    expect(
      await prisma.notification.count({
        where: { bookId: book.id, type: { in: ["BOOK_REQUEST", "HOLD_READY"] } },
      }),
    ).toBe(0);
  });

  test("only the latest return, while it's recent and nobody has it since", async () => {
    const { owner, book } = await lentBook();
    // Not returned yet
    expect(await undoableReturn(book.id)).toBeNull();

    await returnBook(book.id);
    const later = new Date(Date.now() + (UNDO_RETURN_DAYS + 1) * 86_400_000);
    expect(await undoableReturn(book.id)).not.toBeNull();
    expect(await undoableReturn(book.id, later)).toBeNull();

    // Lent to someone else since
    const maya = await makeUser("Maya");
    await lendBook(book.id, maya.id);
    expect(await undoReturn(book.id, { id: owner.id, name: "Olive" })).toBeNull();
  });
});

test("a borrower can pass the book straight to whoever's next in line", async () => {
  const { owner, borrower, book } = await lentBook();
  const next = await makeUser("Kofi");
  const after = await makeUser("Lee");
  await placeHold(book.id, next.id);
  await placeHold(book.id, after.id);

  // Only the one who has it
  expect(await passStraightOn(book.id, next.id)).toBeNull();

  expect(await passStraightOn(book.id, borrower.id)).toMatchObject({ to: { id: next.id } });
  const now = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
  expect(now.borrowerId).toBe(next.id);
  expect(now.dueDate).not.toBeNull();
  // Sam's loan ended, Kofi's began, and Lee is now first in line
  const history = await prisma.lendingHistory.findMany({ where: { bookId: book.id }, orderBy: { borrowedAt: "asc" } });
  expect(history.map((loan) => [loan.borrowerId, loan.returnedAt === null])).toEqual([
    [borrower.id, false],
    [next.id, true],
  ]);
  expect((await getHolds(book.id)).map((hold) => hold.user.id)).toEqual([after.id]);
  // Kofi hears who passed it and whose it is; the owner hears where it went
  const told = await prisma.notification.findMany({
    where: { bookId: book.id, type: { in: ["BOOK_PASSED", "BOOK_PASSED_ON"] } },
    select: { type: true, receiverId: true, senderName: true, message: true },
    orderBy: { type: "asc" },
  });
  expect(told).toEqual([
    { type: "BOOK_PASSED", receiverId: next.id, senderName: "Sam Reader", message: "Olive" },
    { type: "BOOK_PASSED_ON", receiverId: owner.id, senderName: "Sam Reader", message: "Kofi Reader" },
  ]);
});

test("nothing to pass on with no one waiting, or while its owner isn't lending", async () => {
  const { borrower, book } = await lentBook();
  expect(await passStraightOn(book.id, borrower.id)).toBeNull();

  const next = await makeUser("Kofi");
  await placeHold(book.id, next.id);
  await setNotLending(book.id, NOT_LENDING_FOREVER);
  expect(await passStraightOn(book.id, borrower.id)).toBeNull();
  expect((await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).borrowerId).toBe(borrower.id);
});
