// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { getFriendActivity } from "./activity.server";
import {
  chatApp,
  cleanChatUrl,
  clearGroupPick,
  getGroupBoard,
  meetupCalendar,
  setGroupChat,
  setGroupMeeting,
  setGroupPick,
} from "./group-board.server";
import { createGroup } from "./group.server";
import { createFriendship } from "./user.server";

const circe = {
  key: "/works/OL20048856W",
  title: "Circe",
  author: "Madeline Miller",
  cover: "https://covers.openlibrary.org/b/id/8167856-L.jpg",
};

async function club() {
  const maya = await makeUser("Maya");
  const sam = await makeUser("Sam");
  const outsider = await makeUser("Outsider");
  const { id } = await createGroup(maya.id, "Thursday club");
  await prisma.groupMember.create({ data: { groupId: id, userId: sam.id } });
  return { maya, sam, outsider, groupId: id };
}

test("a group starts with nothing on its board, and any member can fill it in", async () => {
  const { maya, sam, outsider, groupId } = await club();
  expect(await getGroupBoard(groupId, maya.id)).toMatchObject({ pick: null, meeting: null, chat: null, changed: null });

  // Only members
  expect(await setGroupPick(outsider.id, groupId, circe)).toBe(false);
  expect(await setGroupPick(sam.id, groupId, circe)).toBe(true);
  await setGroupMeeting(maya.id, groupId, { at: new Date("2026-11-13T19:00:00Z"), place: "  Sam's place " });
  await setGroupChat(maya.id, groupId, cleanChatUrl("chat.whatsapp.com/AbC123"));

  const board = await getGroupBoard(groupId, maya.id);
  expect(board?.pick).toMatchObject({ title: "Circe", pickedBy: { id: sam.id } });
  expect(board?.meeting).toEqual({ at: new Date("2026-11-13T19:00:00Z"), place: "Sam's place" });
  expect(board?.chat).toEqual({ url: "https://chat.whatsapp.com/AbC123", app: "WhatsApp" });
  expect(board?.changed?.by?.id).toBe(maya.id);

  // And clear it again
  await clearGroupPick(sam.id, groupId);
  await setGroupMeeting(sam.id, groupId, { at: null, place: "" });
  await setGroupChat(sam.id, groupId, null);
  expect(await getGroupBoard(groupId, maya.id)).toMatchObject({ pick: null, meeting: null, chat: null, changed: null });
});

test("chat links take only web addresses, and name the app when they can", () => {
  expect(cleanChatUrl("https://signal.group/#abc")).toBe("https://signal.group/#abc");
  expect(cleanChatUrl("discord.gg/xyz")).toBe("https://discord.gg/xyz");
  expect(cleanChatUrl("javascript:alert(1)")).toBeNull();
  expect(cleanChatUrl("not a link")).toBeNull();
  expect(cleanChatUrl("")).toBeNull();
  expect(chatApp("https://discord.gg/xyz")).toBe("Discord");
  expect(chatApp("https://example.com/room")).toBeNull();
});

test("a new pick reaches the group's members in their feeds, with copies among them, and no one else", async () => {
  const { maya, sam, outsider, groupId } = await club();
  const samsCopy = await makeBook(sam.id, "Circe");
  await prisma.book.update({ where: { id: samsCopy.id }, data: { openLibraryKey: circe.key } });
  // Someone outside the group has one too, which the post leaves out
  await makeBook(outsider.id, "Circe");

  await setGroupPick(maya.id, groupId, circe);

  const [post] = (await getFriendActivity(sam.id)).filter((item) => item.kind === "pick");
  expect(post).toMatchObject({
    group: { id: groupId, name: "Thursday club" },
    friend: { id: maya.id },
    work: { title: "Circe" },
  });
  if (post?.kind !== "pick") throw new Error("Expected a pick");
  expect(post.people.map((person) => person.firstname).sort()).toEqual(["Maya", "Sam"]);
  expect(post.viewer.ownCopyId).toBe(samsCopy.id);

  const mayasPost = (await getFriendActivity(maya.id)).find((item) => item.kind === "pick");
  if (mayasPost?.kind !== "pick") throw new Error("Expected a pick");
  expect(mayasPost.viewer.copies).toEqual([
    { bookId: samsCopy.id, owner: { id: sam.id, firstname: "Sam" }, available: true, requested: false },
  ]);

  expect((await getFriendActivity(outsider.id)).some((item) => item.kind === "pick")).toBe(false);

  // Picking it again isn't news
  const before = await prisma.group.findUnique({ where: { id: groupId }, select: { pickedAt: true } });
  await setGroupPick(sam.id, groupId, circe);
  const after = await prisma.group.findUnique({ where: { id: groupId }, select: { pickedAt: true } });
  expect(after?.pickedAt).toEqual(before?.pickedAt);
});

test("the card shows the group's copies of its book and who's finished it", async () => {
  const { maya, sam, outsider, groupId } = await club();
  await createFriendship(maya.id, sam.id);
  const samsCopy = await makeBook(sam.id, "Circe");
  await prisma.book.update({ where: { id: samsCopy.id }, data: { readAt: new Date() } });
  // A copy outside the group doesn't count
  await makeBook(outsider.id, "Circe");
  // Maya read it elsewhere
  await prisma.workNote.create({
    data: { userId: maya.id, workKey: circe.key, title: "Circe", author: circe.author, cover: "", readAt: new Date() },
  });
  await setGroupPick(maya.id, groupId, circe);

  const board = await getGroupBoard(groupId, maya.id);
  expect(board?.pick?.copies).toEqual([
    expect.objectContaining({ bookId: samsCopy.id, owner: expect.objectContaining({ id: sam.id, firstname: "Sam" }), mine: false, available: true }),
  ]);
  expect(board?.pick?.finished.map((person) => person.firstname).sort()).toEqual(["Maya", "Sam"]);
  expect(board?.pick?.memberCount).toBe(2);
});

test("a meetup goes to a calendar as typed: 7pm floating, or all day without a time", () => {
  const evening = meetupCalendar({
    groupId: "g1",
    name: "Thursday club",
    at: new Date("2026-11-05T19:00:00Z"),
    place: "Maya's place, 2nd floor",
    pick: { title: "Circe", author: "Madeline Miller" },
    url: "https://bookstacks.app/groups/thursday-club-g1",
  });
  expect(evening).toContain("DTSTART:20261105T190000\r\n");
  expect(evening).toContain("DTEND:20261105T210000\r\n");
  expect(evening).toContain("SUMMARY:Thursday club: Circe\r\n");
  expect(evening).toContain("LOCATION:Maya's place\\, 2nd floor\r\n");
  expect(evening).toContain("DESCRIPTION:Reading Circe by Madeline Miller\\nhttps://bookstacks.app/groups/thursday-club-g1\r\n");

  const allDay = meetupCalendar({
    groupId: "g1",
    name: "Thursday club",
    at: new Date("2026-11-05T00:00:00Z"),
    place: null,
    pick: null,
    url: "https://bookstacks.app/groups/thursday-club-g1",
  });
  expect(allDay).toContain("DTSTART;VALUE=DATE:20261105\r\n");
  expect(allDay).toContain("DTEND;VALUE=DATE:20261106\r\n");
  expect(allDay).not.toContain("LOCATION");
});

test("a friend outside the group with a copy shows too, after the group's", async () => {
  const { maya, sam, groupId } = await club();
  const priya = await makeUser("Priya");
  await createFriendship(maya.id, priya.id);
  await makeBook(priya.id, "Circe");
  await makeBook(sam.id, "Circe");
  await setGroupPick(maya.id, groupId, circe);

  const copies = (await getGroupBoard(groupId, maya.id))?.pick?.copies ?? [];
  expect(copies.map((copy) => [copy.owner.firstname, copy.inGroup])).toEqual([
    ["Sam", true],
    ["Priya", false],
  ]);
  // Sam doesn't know Priya, so her copy isn't his to see
  const samsCopies = (await getGroupBoard(groupId, sam.id))?.pick?.copies ?? [];
  expect(samsCopies.map((copy) => copy.owner.firstname)).toEqual(["Sam"]);
});
