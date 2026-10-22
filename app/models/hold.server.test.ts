// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { lendBook, returnBook } from "./book.server";
import { getHolds, leaveHold, passToNextInLine, placeHold } from "./hold.server";

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
  expect((await getHolds(book.id)).map((hold) => hold.user.firstname)).toEqual(["Priya"]);
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
    expect((await getHolds(book.id)).map((hold) => hold.user.firstname)).toEqual(["Priya"]);
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
