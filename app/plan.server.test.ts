// @vitest-environment node
import { makeBook, makeUser, prisma } from "../test/db";

import type { ImportRow } from "./import-books";
import { acceptFriendInvite, answerFriendRequest, getFriendInvite } from "./models/friend.server";
import { createHouseholdInvite, joinHousehold } from "./models/household.server";
import { importBooks } from "./models/import.server";
import { createFriendship, createNotification } from "./models/user.server";
import { FREE_LIMITS } from "./plan";
import { getPlanUsage, hasPlus, roomForBooks, roomForFriend } from "./plan.server";

const fillShelf = async (userId: string, count: number) => {
  for (let i = 0; i < count; i++) await makeBook(userId, `Book ${i}`);
};

// Someone with every free friend slot taken
async function popular(name: string) {
  const person = await makeUser(name);
  for (let i = 0; i < FREE_LIMITS.friends; i++) {
    await createFriendship(person.id, (await makeUser(`Friend${i}`)).id);
  }
  return person;
}

const plus = (userId: string) =>
  prisma.user.update({ where: { id: userId }, data: { plan: "plus" } });

test("Plus covers its subscriber, their shared shelf, and every demo", async () => {
  const free = await makeUser("Free");
  expect(await hasPlus(free.id)).toBe(false);

  const priya = await makeUser("Priya");
  const sam = await makeUser("Sam");
  await joinHousehold(sam.id, await createHouseholdInvite(priya.id));
  await plus(priya.id);
  expect(await hasPlus(priya.id)).toBe(true);
  expect(await hasPlus(sam.id)).toBe(true);

  const demo = await makeUser("Demo", { demoGroup: "plan-test" });
  expect(await hasPlus(demo.id)).toBe(true);
});

test("the free shelf holds 100 books, shared shelves together", async () => {
  const me = await makeUser("Me");
  await fillShelf(me.id, FREE_LIMITS.books - 1);
  expect(await roomForBooks(me.id)).toBe(1);

  // A housemate's books share the space
  const housemate = await makeUser("Housemate");
  await joinHousehold(housemate.id, await createHouseholdInvite(me.id));
  await makeBook(housemate.id, "Theirs");
  expect(await roomForBooks(me.id)).toBe(0);
  expect(await getPlanUsage(me.id)).toMatchObject({ plus: false, books: 100, shared: true });

  await plus(housemate.id);
  expect(await roomForBooks(me.id)).toBe(Infinity);
});

test("an import fills the free shelf and says how many didn't fit", async () => {
  const me = await makeUser("Me");
  await fillShelf(me.id, FREE_LIMITS.books - 2);
  const row = (title: string, status: ImportRow["status"] = "read"): ImportRow => ({
    title,
    author: "Someone",
    isbn: null,
    owned: true,
    status,
    readAt: null,
    addedAt: null,
    pageCount: null,
    year: null,
    publisher: null,
  });
  const result = await importBooks(
    me.id,
    [row("A"), row("B"), row("C"), row("D"), { ...row("E", "to-read"), owned: false }],
    { shelf: "owned", wantToRead: true },
  );
  // Two fit, two wait; the want-to-read list has no limit
  expect(result).toMatchObject({ added: 2, overLimit: 2, wanted: 1 });
  expect(await roomForBooks(me.id)).toBe(0);
});

test("a request neither side has room for stays waiting", async () => {
  const full = await popular("Full");
  const asker = await makeUser("Asker");
  const request = await createNotification(asker.id, full.id, "Asker Reader");
  expect(await answerFriendRequest(full.id, request.id, true)).toBe("full");

  const other = await makeUser("Other");
  const theirs = await createNotification(full.id, other.id, "Full Reader");
  expect(await answerFriendRequest(other.id, theirs.id, true)).toBe("they-are-full");

  const pending = await prisma.notification.findMany({
    where: { id: { in: [request.id, theirs.id] } },
    select: { actionTaken: true },
  });
  expect(pending.map((n) => n.actionTaken)).toEqual([null, null]);

  // Declining is always allowed, and Plus lifts the limit
  await plus(full.id);
  expect(await roomForFriend(full.id)).toBe(true);
  expect(await answerFriendRequest(full.id, request.id, true)).toBe("done");
});

test("an invite link waits while either side is full", async () => {
  const full = await popular("Inviter");
  const token = await getFriendInvite(full.id);
  const newcomer = await makeUser("Newcomer");
  expect(await acceptFriendInvite(newcomer.id, token)).toEqual({ ok: false, reason: "they-are-full" });
  await plus(full.id);
  expect(await acceptFriendInvite(newcomer.id, token)).toMatchObject({ ok: true });
});
