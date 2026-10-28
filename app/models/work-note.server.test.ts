// @vitest-environment node
import { getShelfProfile } from "~/profile.server";

import { makeBook, makeUser, prisma } from "../../test/db";

import { createBook } from "./book.server";
import { getShelfCounts } from "./history.server";
import { createFriendship } from "./user.server";
import {
  adoptWorkNotes,
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

test("a book you'd noted joins your shelf: your marks move onto your copy", async () => {
  const me = await makeUser("Me");
  await saveWorkNote(me.id, fox, { loved: true });
  await saveWorkNote(me.id, fox, { read: true });
  await saveWorkNote(me.id, fox, { body: "Read it at the library first." });

  const copy = await createBook({
    title: fox.title,
    author: fox.author,
    body: "",
    cover: fox.cover,
    openLibraryKey: fox.key,
    userId: me.id,
  });
  const onCopy = await prisma.readerNote.findUnique({
    where: { bookId_userId: { bookId: copy.id, userId: me.id } },
  });
  expect(onCopy).toMatchObject({ loved: true, body: "Read it at the library first." });
  expect(onCopy?.readAt).not.toBeNull();
  // Not shown twice
  expect(await getMyWorkNote(me.id, fox.key)).toBeNull();
});

test("a copy whose work is found later takes the marks, keeping what's already on it", async () => {
  const me = await makeUser("Me");
  const someoneElse = await makeUser("Someone");
  await saveWorkNote(me.id, fox, { loved: true, body: "From elsewhere." });
  await saveWorkNote(someoneElse.id, fox, { loved: true });

  // Imported without a work, and already written about on the copy
  const copy = await makeBook(me.id, fox.title);
  await prisma.readerNote.create({ data: { bookId: copy.id, userId: me.id, body: "On my copy." } });
  await prisma.book.update({ where: { id: copy.id }, data: { openLibraryKey: fox.key } });
  await adoptWorkNotes(copy.id);

  const onCopy = await prisma.readerNote.findUnique({
    where: { bookId_userId: { bookId: copy.id, userId: me.id } },
  });
  expect(onCopy).toMatchObject({ loved: true, body: "On my copy." });
  expect(await getMyWorkNote(me.id, fox.key)).toBeNull();
  // Only the shelf's own people: someone else's note stays theirs
  expect(await getMyWorkNote(someoneElse.id, fox.key)).not.toBeNull();
  expect(await prisma.readerNote.count({ where: { bookId: copy.id, userId: someoneElse.id } })).toBe(0);
});

test("a note on a book read elsewhere keeps its time when edited", async () => {
  const reader = await makeUser("Reader");
  const work = { key: "/works/OL1W", title: "Educated", author: "Tara Westover", cover: "" };
  const first = await saveWorkNote(reader.id, work, { body: "The audiobook." });
  await new Promise((resolve) => setTimeout(resolve, 20));

  const edited = await saveWorkNote(
    reader.id,
    work,
    { body: "The audiobook, twice." },
    { keepTime: true },
  );
  expect(edited?.body).toBe("The audiobook, twice.");
  expect(edited?.updatedAt).toEqual(first?.updatedAt);
});
