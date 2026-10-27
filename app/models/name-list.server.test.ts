// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { returnBook } from "./book.server";
import { createHouseholdInvite, joinHousehold } from "./household.server";
import { lendByName } from "./loan-invite.server";
import { addNames, nameList, readNames, removeName } from "./name-list.server";
import { deleteUsers } from "./user.server";

const names = async (userId: string) =>
  (await nameList(userId)).map((person) => `${person.firstname} ${person.surname}`.trim());

test("a pasted class list is one name a line, or names separated by commas", () => {
  expect(readNames("Sam Rivera\n  ava   chen ,Ava Chen; Theo\n\n")).toEqual(["Sam Rivera", "ava chen", "Theo"]);
});

test("names go on the list once, in order, and the household shares it", async () => {
  const dana = await makeUser("Dana");
  expect(await addNames(dana.id, ["Theo", "Sam Rivera", "Ava Chen"])).toEqual({ added: 3, full: false });
  // Already there, however it's typed
  expect(await addNames(dana.id, ["sam rivera", "Maya"])).toEqual({ added: 1, full: false });
  expect(await names(dana.id)).toEqual(["Ava Chen", "Maya", "Sam Rivera", "Theo"]);

  // Names only: no one to email, no one to find
  const [ava] = await nameList(dana.id);
  expect(await prisma.user.findUniqueOrThrow({ where: { id: ava.id } })).toMatchObject({
    nameOnly: true,
    discoverable: false,
    emailNotifications: false,
  });

  // The person Dana shares a shelf with has the same list
  const kim = await makeUser("Kim");
  await joinHousehold(kim.id, await createHouseholdInvite(dana.id));
  expect(await names(kim.id)).toHaveLength(4);
  // Someone else's list is their own
  expect(await names((await makeUser("Priya")).id)).toEqual([]);
});

test("a name is removed for good, with its loans, but not while they have a book out", async () => {
  const dana = await makeUser("Dana");
  const book = await makeBook(dana.id, "Wonder");
  const lent = await lendByName(dana.id, book, { name: "Theo", weeks: 2 });
  if (!lent.ok) throw new Error("not lent");
  // Lending by name puts them on the list
  expect(await names(dana.id)).toEqual(["Theo"]);

  // Not with Wonder still out
  expect(await removeName(dana.id, lent.borrowerId)).toEqual({ ok: false, out: ["Wonder"] });
  expect(await names(dana.id)).toEqual(["Theo"]);

  // Back, then gone: the name and the loan in the history
  await returnBook(book.id);
  expect(await removeName(dana.id, lent.borrowerId)).toEqual({ ok: true });
  expect(await names(dana.id)).toEqual([]);
  expect(await prisma.user.findUnique({ where: { id: lent.borrowerId } })).toBeNull();
  expect(await prisma.lendingHistory.count({ where: { bookId: book.id } })).toBe(0);
  // The book itself stays on the shelf
  expect(await prisma.book.findUnique({ where: { id: book.id } })).not.toBeNull();
});

test("only names on your own list can be removed", async () => {
  const dana = await makeUser("Dana");
  const priya = await makeUser("Priya");
  await addNames(dana.id, ["Theo"]);
  const [theo] = await nameList(dana.id);
  await removeName(priya.id, theo.id);
  expect(await names(dana.id)).toEqual(["Theo"]);
  // And never someone with an account
  expect(await removeName(dana.id, priya.id)).toEqual({ ok: true });
  expect(await prisma.user.findUnique({ where: { id: priya.id } })).not.toBeNull();
});

test("deleting your account deletes your names, unless someone you share the shelf with keeps them", async () => {
  const dana = await makeUser("Dana");
  await addNames(dana.id, ["Theo"]);
  const [theo] = await nameList(dana.id);
  await deleteUsers([dana.id]);
  expect(await prisma.user.findUnique({ where: { id: theo.id } })).toBeNull();

  // On a shared shelf, the one who stays keeps the list
  const walt = await makeUser("Walt");
  const kim = await makeUser("Kim");
  await joinHousehold(kim.id, await createHouseholdInvite(walt.id));
  await addNames(walt.id, ["Bob"]);
  await deleteUsers([walt.id]);
  expect(await names(kim.id)).toEqual(["Bob"]);
});
