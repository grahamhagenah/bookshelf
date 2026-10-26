// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { removeFriend } from "./friend.server";
import {
  GROUP_MAX_MEMBERS,
  cleanGroupName,
  createGroup,
  deleteGroup,
  getGroup,
  getGroupByToken,
  getMyGroups,
  joinGroup,
  leaveGroup,
  removeFromGroup,
  resetGroupLink,
} from "./group.server";
import { getPoolWanted, searchPool } from "./pool.server";
import { createNotification, getFriendStatus } from "./user.server";

const tokenOf = async (groupId: string) =>
  (await prisma.group.findUniqueOrThrow({ where: { id: groupId } })).inviteToken;

test("joining makes you friends with everyone already in the group", async () => {
  const ana = await makeUser("Ana");
  const ben = await makeUser("Ben");
  const cal = await makeUser("Cal");
  const group = await createGroup(ana.id, "Thursday book club");
  const token = await tokenOf(group.id);

  expect(await joinGroup(ben.id, token)).toEqual({ ok: true, groupId: group.id });
  expect(await getFriendStatus(ben.id, ana.id)).toBe("friends");

  // A request Cal had sent Ana is settled by joining
  const request = await createNotification(cal.id, ana.id, "Cal Reader");
  await joinGroup(cal.id, token);
  expect(await getFriendStatus(cal.id, ana.id)).toBe("friends");
  expect(await getFriendStatus(cal.id, ben.id)).toBe("friends");
  expect((await prisma.notification.findUniqueOrThrow({ where: { id: request.id } })).actionTaken).toBe("accepted");

  // Everyone already in hears about it, with the group's name and page
  const notices = await prisma.notification.findMany({
    where: { type: "GROUP_JOINED", senderId: cal.id },
    select: { receiverId: true, message: true, groupId: true },
  });
  expect(notices.map((n) => n.receiverId).sort()).toEqual([ana.id, ben.id].sort());
  expect(notices[0]).toMatchObject({ message: "Thursday book club", groupId: group.id });

  // Joining twice changes nothing
  expect(await joinGroup(cal.id, token)).toEqual({ ok: true, groupId: group.id });
  expect(await prisma.groupMember.count({ where: { groupId: group.id } })).toBe(3);
  expect((await getMyGroups(ben.id)).map((g) => g.memberCount)).toEqual([3]);
});

test("the group's shelf is everyone else's books, only for the people in it", async () => {
  const ana = await makeUser("Ana");
  const ben = await makeUser("Ben");
  const cal = await makeUser("Cal");
  const outsider = await makeUser("Outsider");
  const group = await createGroup(ana.id, "Office");
  await makeBook(ana.id, "Piranesi");
  await makeBook(ben.id, "Middlemarch");
  const lent = await makeBook(ben.id, "Dune Messiah");
  await prisma.book.update({ where: { id: lent.id }, data: { borrowerId: cal.id } });
  await makeBook(cal.id, "Dune");
  await joinGroup(ben.id, await tokenOf(group.id));
  await joinGroup(cal.id, await tokenOf(group.id));

  const page = await getGroup(group.id, ana.id);
  if (!page) throw new Error("no group");
  // Ana's own book stays out of what she browses
  expect(page.openIds.sort()).toEqual([ben.id, cal.id].sort());
  expect(page).toMatchObject({ myBookCount: 1, bookCount: 3 });
  expect(page.members.find((member) => member.id === ben.id)).toMatchObject({ isFriend: true, bookCount: 2 });
  expect(await getGroup(group.id, outsider.id)).toBe(null);

  const titles = async (search: Parameters<typeof searchPool>[1]) =>
    (await searchPool(page.openIds, search)).works.map((work) => work.title).sort();
  expect(await titles({ q: "dune" })).toEqual(["Dune", "Dune Messiah"]);
  expect(await titles({ q: "dune", status: "available" })).toEqual(["Dune"]);
  expect(await titles({ status: "lent" })).toEqual(["Dune Messiah"]);
  expect((await searchPool(page.openIds, {})).counts).toEqual({ all: 3, available: 2, lent: 1 });
  expect(await titles({ who: ben.id })).toEqual(["Dune Messiah", "Middlemarch"]);
  expect((await searchPool(page.openIds, { shown: 1 })).total).toBe(3);

  // Someone you've unfriended keeps their shelf closed to you
  await removeFriend(ana.id, ben.id);
  expect((await getGroup(group.id, ana.id))?.openIds).toEqual([cal.id]);

  // The link's page shows a glimpse to anyone holding it
  expect(await getGroupByToken(await tokenOf(group.id))).toMatchObject({ name: "Office", bookCount: 4 });
});

test("the top of a group's shelf: your wishes someone has, one entry each", async () => {
  const ana = await makeUser("Ana");
  const ben = await makeUser("Ben");
  const group = await createGroup(ana.id, "Club");
  await joinGroup(ben.id, await tokenOf(group.id));
  await makeBook(ben.id, "Piranesi");
  await makeBook(ben.id, "piranesi");
  await makeBook(ben.id, "Middlemarch");
  await prisma.wantToRead.create({ data: { userId: ana.id, title: "Piranesi", author: "Susanna Clarke", cover: "" } });

  const page = await getGroup(group.id, ana.id);
  const { wanted } = await getPoolWanted(ana.id, page?.openIds ?? []);
  // Both copies of Piranesi, as one entry
  expect(wanted.map((work) => [work.title.toLowerCase(), work.copies.length])).toEqual([["piranesi", 2]]);
});

test("leaving keeps friendships, and the last one out ends the group", async () => {
  const ana = await makeUser("Ana");
  const ben = await makeUser("Ben");
  const group = await createGroup(ana.id, "Family");
  await joinGroup(ben.id, await tokenOf(group.id));

  await leaveGroup(ben.id, group.id);
  expect(await getFriendStatus(ben.id, ana.id)).toBe("friends");
  expect(await getGroup(group.id, ben.id)).toBe(null);

  await leaveGroup(ana.id, group.id);
  expect(await prisma.group.count({ where: { id: group.id } })).toBe(0);
});

test("a new link retires the old one", async () => {
  const ana = await makeUser("Ana");
  const group = await createGroup(ana.id, "Street");
  const old = await tokenOf(group.id);
  expect(await resetGroupLink(ana.id, group.id)).toBe(true);
  expect(await joinGroup((await makeUser("Late")).id, old)).toEqual({ ok: false, reason: "no-such-group" });
  // Only someone in the group can change it
  expect(await resetGroupLink((await makeUser("Stranger")).id, group.id)).toBe(false);
});

test("demo and real accounts don't mix, and a full group waits", async () => {
  const ana = await makeUser("Ana");
  const group = await createGroup(ana.id, "Club");
  const token = await tokenOf(group.id);
  const demo = await makeUser("Demo", { demoGroup: "group-test" });
  expect(await joinGroup(demo.id, token)).toEqual({ ok: false, reason: "demo-boundary" });

  for (let i = 1; i < GROUP_MAX_MEMBERS; i++) {
    const member = await makeUser(`Member${i}`);
    await prisma.groupMember.create({ data: { groupId: group.id, userId: member.id } });
  }
  expect(await joinGroup((await makeUser("OneTooMany")).id, token)).toEqual({ ok: false, reason: "full" });
});

test("group names are tidied and kept short", () => {
  expect(cleanGroupName("  Thursday   book club ")).toBe("Thursday book club");
  expect(cleanGroupName("x".repeat(100))).toHaveLength(60);
  expect(cleanGroupName(null)).toBe("");
});

test("a big group's shelf: one entry per book, sorted as asked", async () => {
  const ana = await makeUser("Ana");
  const group = await createGroup(ana.id, "Big club");
  const token = await tokenOf(group.id);
  const [ben, cal] = [await makeUser("Ben"), await makeUser("Cal")];
  await joinGroup(ben.id, token);
  await joinGroup(cal.id, token);
  // Ben and Cal both own Dune; Cal's is out
  await makeBook(ben.id, "Dune");
  const calsDune = await makeBook(cal.id, "Dune");
  await prisma.book.update({ where: { id: calsDune.id }, data: { borrowerId: ana.id } });
  // Ben added one of his own last week
  const piranesi = await makeBook(ben.id, "Piranesi");
  await prisma.book.update({ where: { id: piranesi.id }, data: { createdAt: new Date(Date.now() - 7 * 86_400_000) } });
  // Then Cal imports a pile at once
  for (const title of ["Zorba", "Atlas", "Middlemarch", "Beloved", "Emma"]) await makeBook(cal.id, title);

  const page = await getGroup(group.id, ana.id);
  const openIds = page?.openIds ?? [];
  const { works, total } = await searchPool(openIds, { q: "dune" });
  expect(total).toBe(1);
  // Both copies, the one you could borrow first
  expect(works[0].copies.map((copy) => [copy.owner.firstname, copy.available])).toEqual([
    ["Ben", true],
    ["Cal", false],
  ]);

  const byTitle = await searchPool(openIds, { sort: "title" });
  expect(byTitle.works.map((work) => work.title)).toEqual([
    "Atlas",
    "Beloved",
    "Dune",
    "Emma",
    "Middlemarch",
    "Piranesi",
    "Zorba",
  ]);

});

test("whoever started the group can take people out; nobody else can", async () => {
  const ana = await makeUser("Ana");
  const ben = await makeUser("Ben");
  const cal = await makeUser("Cal");
  const group = await createGroup(ana.id, "Club");
  const token = await tokenOf(group.id);
  await joinGroup(ben.id, token);
  await joinGroup(cal.id, token);

  const page = await getGroup(group.id, ben.id);
  expect(page?.members.filter((member) => member.isOwner).map((member) => member.id)).toEqual([ana.id]);

  // Ben can't, and nobody removes themselves this way
  expect(await removeFromGroup(ben.id, group.id, cal.id)).toBe(false);
  expect(await removeFromGroup(ana.id, group.id, ana.id)).toBe(false);

  expect(await removeFromGroup(ana.id, group.id, cal.id)).toBe(true);
  expect(await getGroup(group.id, cal.id)).toBe(null);
  // Still friends, as after leaving
  expect(await getFriendStatus(cal.id, ana.id)).toBe("friends");

  // When Ana leaves, Ben has been in longest and runs it
  await leaveGroup(ana.id, group.id);
  expect((await getGroup(group.id, ben.id))?.members.find((member) => member.isMe)?.isOwner).toBe(true);
});

test("whoever runs a group can delete it: friendships stay, its notices go", async () => {
  const ana = await makeUser("Ana");
  const ben = await makeUser("Ben");
  const group = await createGroup(ana.id, "Club");
  await joinGroup(ben.id, await tokenOf(group.id));
  expect(await prisma.notification.count({ where: { groupId: group.id } })).toBe(1);

  expect(await deleteGroup(ben.id, group.id)).toBe(false);
  expect(await deleteGroup(ana.id, group.id)).toBe(true);
  expect(await prisma.group.count({ where: { id: group.id } })).toBe(0);
  expect(await prisma.notification.count({ where: { groupId: group.id } })).toBe(0);
  expect(await getFriendStatus(ana.id, ben.id)).toBe("friends");
});

test("the last one out takes the group's notices with it", async () => {
  const ana = await makeUser("Ana");
  const ben = await makeUser("Ben");
  const group = await createGroup(ana.id, "Pair");
  await joinGroup(ben.id, await tokenOf(group.id));
  await leaveGroup(ana.id, group.id);
  await leaveGroup(ben.id, group.id);
  expect(await prisma.notification.count({ where: { groupId: group.id } })).toBe(0);
});
