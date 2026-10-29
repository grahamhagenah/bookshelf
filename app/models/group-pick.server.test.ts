// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { lendBook } from "./book.server";
import { clearGroupPick, getGroupPick, setGroupMeeting, setGroupPick } from "./group-pick.server";
import { createGroup, joinGroup } from "./group.server";
import { saveReaderNote } from "./note.server";
import { createFriendship } from "./user.server";
import { saveWorkNote } from "./work-note.server";

const tokenOf = async (groupId: string) =>
  (await prisma.group.findUniqueOrThrow({ where: { id: groupId } })).inviteToken;

const piranesi = { key: "/works/OL20893680W", title: "Piranesi", author: "Susanna Clarke", cover: "" };

async function club() {
  const ana = await makeUser("Ana");
  const ben = await makeUser("Ben");
  const cal = await makeUser("Cal");
  const group = await createGroup(ana.id, "Club");
  await joinGroup(ben.id, await tokenOf(group.id));
  await joinGroup(cal.id, await tokenOf(group.id));
  return { ana, ben, cal, group };
}

test("any member picks the book; nobody else can", async () => {
  const { ana, ben, group } = await club();
  const outsider = await makeUser("Outsider");

  expect(await getGroupPick(group.id, ana.id)).toBe(null);
  expect(await setGroupPick(outsider.id, group.id, piranesi)).toBe(false);
  expect(await setGroupPick(ben.id, group.id, piranesi)).toBe(true);

  const pick = await getGroupPick(group.id, ana.id);
  expect(pick).toMatchObject({ title: "Piranesi", pickedBy: { id: ben.id, firstname: "Ben" }, meetsAt: null });
  // Not shown to someone outside it
  expect(await getGroupPick(group.id, outsider.id)).toBe(null);

  // A meeting date, which a new pick clears
  const thursday = new Date(Date.now() + 7 * 86_400_000);
  expect(await setGroupMeeting(ana.id, group.id, thursday)).toBe(true);
  expect((await getGroupPick(group.id, ana.id))?.meetsAt).toEqual(thursday);
  await setGroupPick(ana.id, group.id, { ...piranesi, key: null, title: "Middlemarch" });
  expect((await getGroupPick(group.id, ana.id))?.meetsAt).toBe(null);

  expect(await clearGroupPick(ana.id, group.id)).toBe(true);
  expect(await getGroupPick(group.id, ana.id)).toBe(null);
  // No meeting without a book
  expect(await setGroupMeeting(ana.id, group.id, thursday)).toBe(false);
});

test("the pick shows who has a copy, who's finished, and what they thought", async () => {
  const { ana, ben, cal, group } = await club();
  const bensCopy = await makeBook(ben.id, "Piranesi");
  const calsCopy = await makeBook(cal.id, "Piranesi");
  // Cal's is out with Ana, and Cal keeps one more off their page
  await lendBook(calsCopy.id, ana.id);
  const hidden = await makeBook(cal.id, "Piranesi");
  await prisma.book.update({ where: { id: hidden.id }, data: { hiddenFromPage: true } });
  await makeBook(ben.id, "Dune");
  await setGroupPick(ana.id, group.id, { ...piranesi, key: null });

  // Ben read his own copy and wrote about it; Cal read it somewhere else
  await prisma.book.update({ where: { id: bensCopy.id }, data: { readAt: new Date() } });
  await saveReaderNote(ben.id, bensCopy.id, { body: "Strange and lovely." });
  await saveWorkNote(cal.id, { key: "/works/OL1W", title: "Piranesi", author: "", cover: "" }, { read: true });

  const pick = await getGroupPick(group.id, ana.id);
  if (!pick) throw new Error("no pick");
  // Ben's free copy first; Cal's lent one after; the hidden one not at all
  expect(pick.copies.map((copy) => [copy.owner.firstname, copy.available])).toEqual([
    ["Ben", true],
    ["Cal", false],
  ]);
  expect(pick.finished.map((member) => member.firstname)).toEqual(["Ben"]);
  expect(pick.notes).toEqual([{ userId: ben.id, firstname: "Ben", body: "Strange and lovely.", loved: false }]);
  expect(pick.memberCount).toBe(3);

  // A friend of Cal's sees the copy Cal keeps off their page
  await createFriendship(ana.id, cal.id);
  expect((await getGroupPick(group.id, ana.id))?.copies).toHaveLength(3);
});
