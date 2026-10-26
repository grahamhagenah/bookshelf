// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { setHiddenFromFeed } from "./friend.server";
import { saveReaderNote } from "./note.server";
import { getFriendsOfFriends, getLovedByFriends, getWantedAtFriends } from "./rail.server";
import { createFriendship, createNotification } from "./user.server";
import { addWantToRead } from "./wish.server";

const want = (userId: string, title: string) =>
  addWantToRead(userId, { title, author: "Someone", cover: "" });

test("wanted books show only where a friend has a copy", async () => {
  const me = await makeUser("Me");
  const maya = await makeUser("Maya");
  const stranger = await makeUser("Stranger");
  await createFriendship(me.id, maya.id);
  const dune = await makeBook(maya.id, "Dune");
  await makeBook(stranger.id, "Beloved");
  await want(me.id, "Dune");
  await want(me.id, "Beloved");

  expect(await getWantedAtFriends(me.id)).toMatchObject([
    { title: "Dune", bookId: dune.id, owner: "Maya", available: true, others: 0 },
  ]);
});

test("a wanted book points at a copy that's on its shelf", async () => {
  const me = await makeUser("Me");
  const maya = await makeUser("Maya");
  const sam = await makeUser("Sam");
  await createFriendship(me.id, maya.id);
  await createFriendship(me.id, sam.id);
  const mayas = await makeBook(maya.id, "Dune");
  await prisma.book.update({ where: { id: mayas.id }, data: { borrowerId: sam.id } });
  const sams = await makeBook(sam.id, "Dune");
  await want(me.id, "Dune");

  expect(await getWantedAtFriends(me.id)).toMatchObject([
    { bookId: sams.id, owner: "Sam", available: true, others: 1 },
  ]);
});

test("books friends loved, most hearts first, one entry a book", async () => {
  const me = await makeUser("Me");
  const maya = await makeUser("Maya");
  const sam = await makeUser("Sam");
  const stranger = await makeUser("Stranger");
  await createFriendship(me.id, maya.id);
  await createFriendship(me.id, sam.id);
  const mayasDune = await makeBook(maya.id, "Dune");
  const samsDune = await makeBook(sam.id, "Dune");
  const circe = await makeBook(maya.id, "Circe");
  const strangers = await makeBook(stranger.id, "Beloved");
  await saveReaderNote(maya.id, circe.id, { loved: true });
  await saveReaderNote(maya.id, mayasDune.id, { loved: true });
  await saveReaderNote(sam.id, samsDune.id, { loved: true });
  await saveReaderNote(stranger.id, strangers.id, { loved: true });

  const loved = await getLovedByFriends(me.id);
  expect(loved.map((book) => [book.title, book.friends.map((f) => f.firstname).sort()])).toEqual([
    ["Dune", ["Maya", "Sam"]],
    ["Circe", ["Maya"]],
  ]);
  expect(loved[1].href).toBe(`/books/${circe.id}`);
});

test("loved books leave out friends hidden from the feed", async () => {
  const me = await makeUser("Me");
  const maya = await makeUser("Maya");
  await createFriendship(me.id, maya.id);
  const circe = await makeBook(maya.id, "Circe");
  await saveReaderNote(maya.id, circe.id, { loved: true });
  await setHiddenFromFeed(me.id, maya.id, true);

  expect(await getLovedByFriends(me.id)).toEqual([]);
});

test("friends of friends, most in common first, leaving out anyone already asked", async () => {
  const me = await makeUser("Me");
  const maya = await makeUser("Maya");
  const sam = await makeUser("Sam");
  const lena = await makeUser("Lena");
  const theo = await makeUser("Theo");
  const hidden = await makeUser("Hidden");
  const asked = await makeUser("Asked");
  await createFriendship(me.id, maya.id);
  await createFriendship(me.id, sam.id);
  await createFriendship(maya.id, sam.id);
  await createFriendship(maya.id, lena.id);
  await createFriendship(maya.id, theo.id);
  await createFriendship(sam.id, theo.id);
  await createFriendship(maya.id, hidden.id);
  await createFriendship(maya.id, asked.id);
  await prisma.user.update({ where: { id: hidden.id }, data: { discoverable: false } });
  await createNotification(asked.id, me.id, "Asked Reader");

  const people = await getFriendsOfFriends(me.id);
  expect(people.map((person) => [person.firstname, person.through])).toEqual([
    ["Theo", ["Maya", "Sam"]],
    ["Lena", ["Maya"]],
  ]);
});
