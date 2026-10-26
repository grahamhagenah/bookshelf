// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { removeFriend } from "./friend.server";
import {
  GROUP_MAX_MEMBERS,
  cleanGroupName,
  createGroup,
  getGroup,
  getGroupByToken,
  getGroupHighlights,
  getMyGroups,
  joinGroup,
  leaveGroup,
  resetGroupLink,
  searchGroupBooks,
} from "./group.server";
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

  const titles = async (search: Parameters<typeof searchGroupBooks>[1]) =>
    (await searchGroupBooks(page.openIds, search)).books.map((book) => book.title).sort();
  expect(await titles({ q: "dune" })).toEqual(["Dune", "Dune Messiah"]);
  expect(await titles({ q: "dune", available: true })).toEqual(["Dune"]);
  expect(await titles({ who: ben.id })).toEqual(["Dune Messiah", "Middlemarch"]);
  expect((await searchGroupBooks(page.openIds, { shown: 1 })).total).toBe(3);

  // Someone you've unfriended keeps their shelf closed to you
  await removeFriend(ana.id, ben.id);
  expect((await getGroup(group.id, ana.id))?.openIds).toEqual([cal.id]);

  // The link's page shows a glimpse to anyone holding it
  expect(await getGroupByToken(await tokenOf(group.id))).toMatchObject({ name: "Office", bookCount: 4 });
});

test("the top of a group's page: your wishes someone has, then what's new", async () => {
  const ana = await makeUser("Ana");
  const ben = await makeUser("Ben");
  const group = await createGroup(ana.id, "Club");
  await joinGroup(ben.id, await tokenOf(group.id));
  await makeBook(ben.id, "Piranesi");
  await makeBook(ben.id, "piranesi");
  await makeBook(ben.id, "Middlemarch");
  await prisma.wantToRead.create({ data: { userId: ana.id, title: "Piranesi", author: "Susanna Clarke", cover: "" } });

  const page = await getGroup(group.id, ana.id);
  const { wanted, newest } = await getGroupHighlights(ana.id, page?.openIds ?? []);
  // One copy of each book you want
  expect(wanted.map((book) => book.title.toLowerCase())).toEqual(["piranesi"]);
  expect(newest).toHaveLength(3);
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
