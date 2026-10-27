// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { checkIn, checkOut, findOnShelf, loansOut } from "./checkout.server";
import { placeHold } from "./hold.server";
import { addNames, nameList } from "./name-list.server";

afterEach(() => {
  vi.unstubAllGlobals();
});

// A book of Dana's with an ISBN, as a class set would be
async function copyOf(userId: string, title: string, details: { isbn?: string; openLibraryKey?: string } = {}) {
  const book = await makeBook(userId, title);
  return prisma.book.update({ where: { id: book.id }, data: details });
}

test("a scanned barcode finds the copy saved with either form of its ISBN", async () => {
  const dana = await makeUser("Dana");
  const wonder = await copyOf(dana.id, "Wonder", { isbn: "0375869026" });
  await copyOf((await makeUser("Priya")).id, "Wonder", { isbn: "9780375869020" });

  // Only Dana's own copy
  expect((await findOnShelf(dana.id, "9780375869020")).map((book) => book.id)).toEqual([wonder.id]);
  expect((await findOnShelf(dana.id, "978-0-375-86902-0")).map((book) => book.id)).toEqual([wonder.id]);
});

test("another edition's barcode finds the book through Open Library's work", async () => {
  const dana = await makeUser("Dana");
  const key = `/works/OL${crypto.randomUUID().slice(0, 8)}W`;
  const holes = await copyOf(dana.id, "Holes", { isbn: "0440414806", openLibraryKey: key });
  vi.stubGlobal("fetch", async () =>
    new Response(JSON.stringify({ docs: [{ key, title: "Holes", author_name: ["Louis Sachar"] }] }), { status: 200 }),
  );
  // A paperback with a barcode of its own
  expect((await findOnShelf(dana.id, "9780374332662")).map((book) => book.id)).toEqual([holes.id]);
});

test("typed words find titles and authors on the shelf", async () => {
  const dana = await makeUser("Dana");
  const word = `Zq${crypto.randomUUID().slice(0, 6)}`;
  const book = await copyOf(dana.id, `The ${word} Tree`);
  expect((await findOnShelf(dana.id, word.toLowerCase())).map((found) => found.id)).toEqual([book.id]);
  expect(await findOnShelf(dana.id, "z")).toEqual([]);
});

test("of a class set, a copy on the shelf goes to a name on the list; back, it's asked for by whoever's waiting", async () => {
  const dana = await makeUser("Dana");
  const copies = [
    await copyOf(dana.id, "Wonder", { isbn: "0375869026" }),
    await copyOf(dana.id, "Wonder", { isbn: "0375869026" }),
  ];
  await addNames(dana.id, ["Theo", "Ava Chen"]);
  const [ava, theo] = await nameList(dana.id);
  const bookIds = copies.map((copy) => copy.id);

  const first = await checkOut(dana.id, { bookIds, personId: theo.id, weeks: 2 });
  expect(first).toMatchObject({ title: "Wonder", person: { firstname: "Theo" } });
  const second = await checkOut(dana.id, { bookIds, personId: ava.id, weeks: 2 });
  expect(second).toMatchObject({ person: { firstname: "Ava" } });
  // None left to lend
  expect(await checkOut(dana.id, { bookIds, personId: ava.id, weeks: 2 })).toBeNull();
  expect((await loansOut(dana.id)).map((book) => book.borrower?.firstname).sort()).toEqual(["Ava", "Theo"]);

  // A friend waiting for it hears when it's back
  const friend = await makeUser("Friend");
  await placeHold(copies[0].id, friend.id);
  expect(await checkIn(dana.id, copies[0].id)).toMatchObject({ title: "Wonder", person: { firstname: "Theo" } });
  expect((await prisma.book.findUniqueOrThrow({ where: { id: copies[0].id } })).borrowerId).toBeNull();
  expect(
    await prisma.notification.count({ where: { type: "BOOK_REQUEST", bookId: copies[0].id, senderId: friend.id } }),
  ).toBe(1);
  // It isn't out any more
  expect(await checkIn(dana.id, copies[0].id)).toBeNull();
});

test("only your own books, and only names on your list", async () => {
  const dana = await makeUser("Dana");
  const priya = await makeUser("Priya");
  const theirs = await copyOf(priya.id, "Holes");
  const mine = await copyOf(dana.id, "Holes");
  await addNames(dana.id, ["Theo"]);
  await addNames(priya.id, ["Mo"]);
  const [theo] = await nameList(dana.id);
  const [mo] = await nameList(priya.id);

  expect(await checkOut(dana.id, { bookIds: [theirs.id], personId: theo.id, weeks: 2 })).toBeNull();
  expect(await checkOut(dana.id, { bookIds: [mine.id], personId: mo.id, weeks: 2 })).toBeNull();
  await checkOut(priya.id, { bookIds: [theirs.id], personId: mo.id, weeks: 2 });
  expect(await checkIn(dana.id, theirs.id)).toBeNull();
});
