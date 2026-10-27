// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { getBookListItems, searchFriendsBooks } from "./book.server";
import {
  createHouseholdInvite,
  getHousehold,
  joinHousehold,
  leaveHousehold,
  shelfIds,
} from "./household.server";
import { canLeaveNote } from "./note.server";
import { createFriendship } from "./user.server";

async function couple() {
  const priya = await makeUser("Priya");
  const sam = await makeUser("Sam");
  const token = await createHouseholdInvite(priya.id);
  expect(await joinHousehold(sam.id, token)).toEqual({ ok: true, members: ["Priya"] });
  return { priya, sam, token };
}

test("an invite brings someone onto your shelf, and the same link is reused", async () => {
  const { priya, sam, token } = await couple();
  expect(await createHouseholdInvite(priya.id)).toBe(token);
  expect((await shelfIds(sam.id)).sort()).toEqual([priya.id, sam.id].sort());
  const household = await getHousehold(sam.id);
  expect(household?.members.map((m) => m.firstname)).toEqual(["Priya", "Sam"]);
  // Joining again is harmless
  expect((await joinHousehold(sam.id, token)).ok).toBe(true);
});

test("whoever shared the link hears that someone joined", async () => {
  const { priya, sam } = await couple();
  expect(
    await prisma.notification.findMany({
      where: { type: "SHELF_JOINED", receiverId: priya.id },
      select: { senderId: true, senderName: true },
    }),
  ).toEqual([{ senderId: sam.id, senderName: "Sam Reader" }]);
});

test("each other's books count as your own; notes stay per person", async () => {
  const { priya, sam } = await couple();
  const hers = await makeBook(priya.id, "Piranesi");
  await makeBook(sam.id, "Dune");

  const titles = (await getBookListItems(await shelfIds(sam.id))).map((b) => b.title).sort();
  expect(titles).toEqual(["Dune", "Piranesi"]);
  expect(await canLeaveNote(sam.id, { id: hers.id, userId: priya.id, borrowerId: null })).toBe(true);
});

test("a friend of one of you can see the whole shelf", async () => {
  const { priya, sam } = await couple();
  const maya = await makeUser("Maya");
  await createFriendship(maya.id, priya.id);
  await makeBook(sam.id, "The Overstory");

  const found = await searchFriendsBooks(maya.id, "Overstory");
  expect(found.map((b) => b.title)).toEqual(["The Overstory"]);
});

test("you can't join a second shelf while sharing one, and leaving takes your books with you", async () => {
  const { priya, sam } = await couple();
  const other = await makeUser("Other");
  const otherToken = await createHouseholdInvite(other.id);
  expect(await joinHousehold(sam.id, otherToken)).toEqual({ ok: false, reason: "already-in-one" });

  await makeBook(sam.id, "Dune");
  await leaveHousehold(sam.id);
  expect(await shelfIds(sam.id)).toEqual([sam.id]);
  expect((await getBookListItems(await shelfIds(priya.id))).map((b) => b.title)).toEqual([]);
  // Priya keeps the household (and its invite) for the next person
  expect(await getHousehold(priya.id)).not.toBeNull();
  expect(await getHousehold(sam.id)).toBeNull();
});

test("demo sandboxes and real accounts don't mix", async () => {
  const real = await makeUser("Real");
  const demo = await makeUser("Demo", { demoGroup: "household-test" });
  const token = await createHouseholdInvite(real.id);
  expect(await joinHousehold(demo.id, token)).toEqual({ ok: false, reason: "demo-boundary" });
  expect(await joinHousehold(demo.id, "nope")).toEqual({ ok: false, reason: "no-such-invite" });
  await prisma.household.deleteMany({ where: { inviteToken: token } });
});
