// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { circleOf, inCircle } from "./circle.server";
import {
  GROUP_MAX_MEMBERS,
  cleanGroupName,
  createGroup,
  deleteGroup,
  describeGroup,
  getGroup,
  getGroupByToken,
  getMyGroups,
  joinGroup,
  leaveGroup,
  removeFromGroup,
  resetGroupLink,
  setGroupPlanning,
} from "./group.server";
import { getPoolWanted, searchPool } from "./pool.server";
import { createFriendship, createNotification, getFriendStatus } from "./user.server";

const tokenOf = async (groupId: string) =>
  (await prisma.group.findUniqueOrThrow({ where: { id: groupId } })).inviteToken;

test("joining opens everyone's shelves without making anyone friends", async () => {
  const ana = await makeUser("Ana");
  const ben = await makeUser("Ben");
  const cal = await makeUser("Cal");
  const group = await createGroup(ana.id, "Thursday book club");
  const token = await tokenOf(group.id);

  expect(await joinGroup(ben.id, token)).toEqual({ ok: true, groupId: group.id });
  expect(await getFriendStatus(ben.id, ana.id)).not.toBe("friends");
  // In each other's circle all the same, both ways
  expect([...(await circleOf(ben.id)).groupOnly]).toEqual([ana.id]);
  expect([...(await circleOf(ana.id)).groupOnly]).toEqual([ben.id]);

  // A request Cal had sent Ana is left for Ana to answer
  const request = await createNotification(cal.id, ana.id, "Cal Reader");
  await joinGroup(cal.id, token);
  expect(await getFriendStatus(cal.id, ana.id)).not.toBe("friends");
  expect((await prisma.notification.findUniqueOrThrow({ where: { id: request.id } })).actionTaken).toBe(null);

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
  // One Ben keeps off his page
  const secret = await makeBook(ben.id, "Diary");
  await prisma.book.update({ where: { id: secret.id }, data: { hiddenFromPage: true } });
  await joinGroup(ben.id, await tokenOf(group.id));
  await joinGroup(cal.id, await tokenOf(group.id));

  const page = await getGroup(group.id, ana.id);
  if (!page) throw new Error("no group");
  // Ana's own book stays out of what she browses; nobody here is her friend,
  // and Ben's hidden book stays out
  expect(page.openIds.sort()).toEqual([ben.id, cal.id].sort());
  expect(page.groupOnly.sort()).toEqual([ben.id, cal.id].sort());
  expect(page).toMatchObject({ myBookCount: 1, bookCount: 3 });
  expect(page.members.find((member) => member.id === ben.id)).toMatchObject({ isFriend: false, bookCount: 3 });
  expect(await getGroup(group.id, outsider.id)).toBe(null);

  const titles = async (search: Parameters<typeof searchPool>[1]) =>
    (await searchPool(page.openIds, { groupOnly: page.groupOnly, ...search })).works.map((work) => work.title).sort();
  expect(await titles({ q: "dune" })).toEqual(["Dune", "Dune Messiah"]);
  expect(await titles({ q: "dune", status: "available" })).toEqual(["Dune"]);
  expect(await titles({ status: "lent" })).toEqual(["Dune Messiah"]);
  expect((await searchPool(page.openIds, { groupOnly: page.groupOnly })).counts).toEqual({ all: 3, available: 2, lent: 1 });
  expect(await titles({ who: ben.id })).toEqual(["Dune Messiah", "Middlemarch"]);
  expect((await searchPool(page.openIds, { groupOnly: page.groupOnly, shown: 1 })).total).toBe(3);
  expect(await inCircle(ana.id, lent)).toBe(true);
  expect(await inCircle(ana.id, { ...secret, hiddenFromPage: true })).toBe(false);
  expect(await inCircle(outsider.id, lent)).toBe(false);

  // Friends see the hidden one too
  await createFriendship(ana.id, ben.id);
  expect(await inCircle(ana.id, { ...secret, hiddenFromPage: true })).toBe(true);
  expect((await getGroup(group.id, ana.id))?.bookCount).toBe(4);

  // The link's page shows a glimpse to anyone holding it, nothing hidden
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

test("leaving closes the other shelves, and the last one out ends the group", async () => {
  const ana = await makeUser("Ana");
  const ben = await makeUser("Ben");
  const group = await createGroup(ana.id, "Family");
  await joinGroup(ben.id, await tokenOf(group.id));
  expect((await circleOf(ben.id)).ids).toEqual([ana.id]);

  await leaveGroup(ben.id, group.id);
  expect((await circleOf(ben.id)).ids).toEqual([]);
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

  // Popular: the most lent first, both Dunes' loans counted together
  await prisma.book.update({ where: { id: piranesi.id }, data: { lendCount: 2 } });
  await prisma.book.update({ where: { id: calsDune.id }, data: { lendCount: 3 } });
  const popular = await searchPool(openIds, { sort: "popular" });
  expect(popular.works.slice(0, 2).map((work) => [work.title, work.loans])).toEqual([
    ["Dune", 3],
    ["Piranesi", 2],
  ]);
  expect(popular.works.slice(2).every((work) => work.loans === 0)).toBe(true);
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
  // Out of the circle, as after leaving
  expect((await circleOf(cal.id)).ids).toEqual([]);

  // When Ana leaves, Ben has been in longest and runs it
  await leaveGroup(ana.id, group.id);
  expect((await getGroup(group.id, ben.id))?.members.find((member) => member.isMe)?.isOwner).toBe(true);
});

test("whoever runs a group can delete it, and its notices go", async () => {
  const ana = await makeUser("Ana");
  const ben = await makeUser("Ben");
  const group = await createGroup(ana.id, "Club");
  await joinGroup(ben.id, await tokenOf(group.id));
  expect(await prisma.notification.count({ where: { groupId: group.id } })).toBe(1);

  expect(await deleteGroup(ben.id, group.id)).toBe(false);
  expect(await deleteGroup(ana.id, group.id)).toBe(true);
  expect(await prisma.group.count({ where: { id: group.id } })).toBe(0);
  expect(await prisma.notification.count({ where: { groupId: group.id } })).toBe(0);
  expect((await circleOf(ben.id)).ids).toEqual([]);
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

test("anyone in a group can describe it; only whoever runs it turns its planning card off", async () => {
  const ana = await makeUser("Ana");
  const ben = await makeUser("Ben");
  const stranger = await makeUser("Stranger");
  const { id } = await createGroup(ana.id, "Book club");
  await joinGroup(ben.id, await tokenOf(id));

  expect(await describeGroup(stranger.id, id, "Not mine to say")).toBe(false);
  expect(await describeGroup(ben.id, id, "  First Thursdays, mostly novels.  ")).toBe(true);
  expect((await getGroup(id, ana.id))?.description).toBe("First Thursdays, mostly novels.");
  // It shows on the invite too
  expect((await getGroupByToken(await tokenOf(id)))?.description).toBe("First Thursdays, mostly novels.");
  await describeGroup(ana.id, id, "   ");
  expect((await getGroup(id, ana.id))?.description).toBeNull();

  expect((await getGroup(id, ana.id))?.planning).toBe(true);
  expect(await setGroupPlanning(ben.id, id, false)).toBe(false);
  expect(await setGroupPlanning(ana.id, id, false)).toBe(true);
  expect((await getGroup(id, ben.id))?.planning).toBe(false);
});

test("the group knows who you've already asked to be friends", async () => {
  const ana = await makeUser("Ana");
  const ben = await makeUser("Ben");
  const { id } = await createGroup(ana.id, "Book club");
  await joinGroup(ben.id, await tokenOf(id));
  const ben1 = (await getGroup(id, ana.id))?.members.find((member) => member.id === ben.id);
  expect(ben1).toMatchObject({ isFriend: false, requested: false });
  await createNotification(ana.id, ben.id, "Ana Reader");
  const ben2 = (await getGroup(id, ana.id))?.members.find((member) => member.id === ben.id);
  expect(ben2).toMatchObject({ isFriend: false, requested: true });
});
