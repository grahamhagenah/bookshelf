// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { getFriendActivity } from "./activity.server";
import {
  chatApp,
  cleanChatUrl,
  clearGroupPick,
  getGroupBoard,
  setGroupChat,
  setGroupMeeting,
  setGroupPick,
} from "./group-board.server";
import { createGroup } from "./group.server";

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
  expect(await getGroupBoard(groupId)).toMatchObject({ pick: null, meeting: null, chat: null, changed: null });

  // Only members
  expect(await setGroupPick(outsider.id, groupId, circe)).toBe(false);
  expect(await setGroupPick(sam.id, groupId, circe)).toBe(true);
  await setGroupMeeting(maya.id, groupId, { at: new Date("2026-11-13T19:00:00Z"), place: "  Sam's place " });
  await setGroupChat(maya.id, groupId, cleanChatUrl("chat.whatsapp.com/AbC123"));

  const board = await getGroupBoard(groupId);
  expect(board?.pick).toMatchObject({ title: "Circe", pickedBy: { id: sam.id } });
  expect(board?.meeting).toEqual({ at: new Date("2026-11-13T19:00:00Z"), place: "Sam's place" });
  expect(board?.chat).toEqual({ url: "https://chat.whatsapp.com/AbC123", app: "WhatsApp" });
  expect(board?.changed?.by?.id).toBe(maya.id);

  // And clear it again
  await clearGroupPick(sam.id, groupId);
  await setGroupMeeting(sam.id, groupId, { at: null, place: "" });
  await setGroupChat(sam.id, groupId, null);
  expect(await getGroupBoard(groupId)).toMatchObject({ pick: null, meeting: null, chat: null, changed: null });
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
