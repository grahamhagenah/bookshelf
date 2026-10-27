// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { createHouseholdInvite, joinHousehold } from "./household.server";
import { lendByName } from "./loan-invite.server";
import { addNames, findOrAddName, nameList, readNames, unlistName } from "./name-list.server";

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

test("taken off the list, someone keeps their loan, and lending to them again puts them back", async () => {
  const dana = await makeUser("Dana");
  const book = await makeBook(dana.id, "Wonder");
  const lent = await lendByName(dana.id, book, { name: "Theo", weeks: 2 });
  if (!lent.ok) throw new Error("not lent");
  // Lending by name puts them on the list
  expect(await names(dana.id)).toEqual(["Theo"]);

  await unlistName(dana.id, lent.borrowerId);
  expect(await names(dana.id)).toEqual([]);
  expect((await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).borrowerId).toBe(lent.borrowerId);

  // The same Theo, not a second one
  expect((await findOrAddName(dana.id, "theo"))?.id).toBe(lent.borrowerId);
  expect(await names(dana.id)).toEqual(["Theo"]);
});

test("only names on your own list can be taken off it", async () => {
  const dana = await makeUser("Dana");
  const priya = await makeUser("Priya");
  await addNames(dana.id, ["Theo"]);
  const [theo] = await nameList(dana.id);
  await unlistName(priya.id, theo.id);
  expect(await names(dana.id)).toEqual(["Theo"]);
});
