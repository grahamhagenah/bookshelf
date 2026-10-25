// @vitest-environment node
import { getShelfProfile } from "~/profile.server";

import { makeBook, makeUser, prisma } from "../../test/db";

import { getShelfCounts } from "./history.server";
import { createFriendship } from "./user.server";
import {
  getFriendsWorkNotes,
  getMyWorkNote,
  getWorkNotes,
  getWorkSnapshot,
  listMyWorkNotes,
  saveWorkNote,
} from "./work-note.server";

const fox = {
  key: "/works/OL45804W",
  title: "Fantastic Mr Fox",
  author: "Roald Dahl",
  cover: "https://covers.openlibrary.org/b/id/6498519-L.jpg",
};

test("a heart, read mark and note on a book read elsewhere, gone when all are taken back", async () => {
  const me = await makeUser("Me");
  await saveWorkNote(me.id, fox, { loved: true });
  await saveWorkNote(me.id, fox, { read: true });
  await saveWorkNote(me.id, fox, { body: "  Read it twice in a weekend.  " });

  const mine = await getMyWorkNote(me.id, fox.key);
  expect(mine).toMatchObject({
    loved: true,
    body: "Read it twice in a weekend.",
  });
  expect(mine?.readAt).toBeInstanceOf(Date);
  expect((await listMyWorkNotes(me.id)).map((note) => note.title)).toEqual([
    "Fantastic Mr Fox",
  ]);
  // Saved well enough to show without Open Library
  expect(await getWorkSnapshot(fox.key)).toEqual({
    title: fox.title,
    author: fox.author,
    cover: fox.cover,
  });
  // Its own tab, and none of the shelf's book limit
  expect(await getShelfCounts(me.id)).toMatchObject({
    library: 0,
    elsewhere: 1,
  });

  await saveWorkNote(me.id, fox, { loved: false });
  await saveWorkNote(me.id, fox, { read: false });
  expect(await saveWorkNote(me.id, fox, { body: null })).toBeNull();
  expect(await getMyWorkNote(me.id, fox.key)).toBeNull();
});

test("hearts and notes reach friends, from elsewhere and from their copies, never strangers", async () => {
  const me = await makeUser("Me");
  const priya = await makeUser("Priya");
  const sam = await makeUser("Sam");
  const stranger = await makeUser("Stranger");
  await createFriendship(me.id, priya.id);
  await createFriendship(me.id, sam.id);

  await saveWorkNote(me.id, fox, { body: "Mine" });
  await saveWorkNote(priya.id, fox, { loved: true });
  await saveWorkNote(stranger.id, fox, { body: "Not for you" });
  // Read marks alone say nothing to anyone
  await saveWorkNote(sam.id, fox, { read: true });
  // Sam's own copy, with a note on it
  const samsCopy = await makeBook(sam.id, "Fantastic Mr Fox");
  await prisma.book.update({
    where: { id: samsCopy.id },
    data: { openLibraryKey: fox.key },
  });
  await prisma.readerNote.create({
    data: { bookId: samsCopy.id, userId: sam.id, body: "On my copy" },
  });

  const notes = await getWorkNotes(me.id, fox.key);
  expect(
    notes.map((note) => [note.user.firstname, note.body, note.loved]).sort(),
  ).toEqual([
    ["Me", "Mine", false],
    ["Priya", null, true],
    ["Sam", "On my copy", false],
  ]);

  // On a friend's copy page: friends who read it elsewhere, minus those
  // already there
  const elsewhere = await getFriendsWorkNotes(me.id, fox.key, [sam.id]);
  expect(elsewhere.map((note) => note.user.firstname)).toEqual(["Priya"]);
});

test("a book read elsewhere and hearted is among the page's favorites, unlinked", async () => {
  const me = await makeUser("Me");
  await makeBook(me.id, "Dune");
  await saveWorkNote(me.id, fox, { loved: true });
  const { favorites } = await getShelfProfile(me.id);
  expect(favorites.map((book) => [book.title, book.onShelf])).toEqual([
    ["Fantastic Mr Fox", false],
  ]);
});
