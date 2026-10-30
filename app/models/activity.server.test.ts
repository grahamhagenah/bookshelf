// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { getFriendActivity, getNotePrompts } from "./activity.server";
import { lendBook, setRead } from "./book.server";
import { getFriendCards, setHiddenFromFeed } from "./friend.server";
import { saveReaderNote } from "./note.server";
import { createFriendship } from "./user.server";
import { addWantToRead } from "./wish.server";
import { saveWorkNote } from "./work-note.server";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

async function bookAddedAt(userId: string, title: string, at: Date) {
  const book = await makeBook(userId, title);
  return prisma.book.update({
    where: { id: book.id },
    data: { createdAt: at },
  });
}

async function setup() {
  const me = await makeUser("Me");
  const friend = await makeUser("Maya");
  const stranger = await makeUser("Stranger");
  await createFriendship(me.id, friend.id);
  return { me, friend, stranger };
}

test("nothing to show without friends", async () => {
  const loner = await makeUser("Loner");
  await makeBook(loner.id);
  expect(await getFriendActivity(loner.id)).toEqual([]);
});

test("batches a friend's additions that land within a week", async () => {
  const { me, friend } = await setup();
  await bookAddedAt(friend.id, "Gilead", daysAgo(1));
  await bookAddedAt(friend.id, "Beloved", daysAgo(3));
  await bookAddedAt(friend.id, "Normal People", daysAgo(6));
  // More than a week before the newest: its own batch
  await bookAddedAt(friend.id, "The Overstory", daysAgo(20));

  const feed = await getFriendActivity(me.id);
  const batches = feed.flatMap((item) =>
    item.kind === "added"
      ? [
          {
            friend: item.friend.id,
            titles: item.books.map((book) => book.title),
          },
        ]
      : [],
  );
  expect(batches).toEqual([
    { friend: friend.id, titles: ["Gilead", "Beloved", "Normal People"] },
    { friend: friend.id, titles: ["The Overstory"] },
  ]);
});

test("shows hearts and notes, but only from friends", async () => {
  const { me, friend, stranger } = await setup();
  const book = await makeBook(me.id, "Circe");
  const other = await makeBook(me.id, "Dune");

  await saveReaderNote(friend.id, book.id, { loved: true, body: "Gorgeous." });
  await saveReaderNote(friend.id, other.id, { loved: true });
  await saveReaderNote(stranger.id, book.id, {
    loved: true,
    body: "Not a friend",
  });
  // A note with neither a heart nor words isn't news
  await saveReaderNote(friend.id, (await makeBook(me.id, "Blank")).id, {
    loved: false,
  });

  const reactions = (await getFriendActivity(me.id)).filter(
    (item) => item.kind !== "added",
  );
  expect(reactions).toHaveLength(2);
  expect(reactions.every((item) => item.friend.id === friend.id)).toBe(true);
  expect(reactions.map((item) => item.kind).sort()).toEqual(["loved", "note"]);
  const note = reactions.find((item) => item.kind === "note");
  expect(note).toMatchObject({
    body: "Gorgeous.",
    loved: true,
    book: { title: "Circe" },
  });
});

test("leaves out old news and your own activity, newest first", async () => {
  const { me, friend } = await setup();
  await bookAddedAt(friend.id, "Long ago", daysAgo(90));
  await bookAddedAt(friend.id, "Recent", daysAgo(2));
  await bookAddedAt(me.id, "Mine", daysAgo(1));
  const book = await makeBook(me.id, "Loved today");
  await saveReaderNote(friend.id, book.id, { loved: true });

  const feed = await getFriendActivity(me.id);
  const titles = feed.map((item) =>
    item.kind === "added"
      ? item.books.map((b) => b.title).join()
      : item.kind === "elsewhere" || item.kind === "pick"
        ? item.work.title
        : item.book.title,
  );
  expect(titles).toEqual(["Loved today", "Recent"]);
});

test("stops at the limit", async () => {
  const { me, friend } = await setup();
  for (let i = 0; i < 5; i++) {
    const book = await makeBook(me.id, `Book ${i}`);
    await saveReaderNote(friend.id, book.id, { loved: true });
  }
  expect(await getFriendActivity(me.id, { limit: 3 })).toHaveLength(3);
});

test("feed books carry hearts, notes and where you stand with them", async () => {
  const { me, friend } = await setup();
  const other = await makeUser("Other");
  await createFriendship(friend.id, other.id);
  const book = await bookAddedAt(friend.id, "Circe", daysAgo(1));
  await saveReaderNote(friend.id, book.id, { loved: true, body: "Lovely." });
  await saveReaderNote(other.id, book.id, { loved: true });

  const [item] = await getFriendActivity(me.id);
  if (item.kind === "elsewhere" || item.kind === "pick") throw new Error("Expected a copy");
  const seen = item.kind === "added" ? item.books[0] : item.book;
  // Who wrote, not who only hearted it
  expect(seen).toMatchObject({ loves: 2, notes: 1, noteWriters: ["Maya"], available: true });
  // Not a reader of this copy, but a friend of its owner
  expect(seen.viewer).toEqual({
    loved: false,
    canLove: false,
    canRequest: true,
    requested: false,
    inLine: false,
    readIt: false,
    onShelf: false,
    wanted: false,
  });
});

test("note prompts are the books you've borrowed and not written about", async () => {
  const { me, friend } = await setup();
  const current = await makeBook(friend.id, "Piranesi");
  const done = await makeBook(friend.id, "Circe");
  const noted = await makeBook(friend.id, "Dune");
  await lendBook(current.id, me.id);
  for (const book of [done, noted]) {
    await prisma.lendingHistory.create({
      data: {
        bookId: book.id,
        borrowerId: me.id,
        borrowedAt: daysAgo(30),
        returnedAt: daysAgo(5),
      },
    });
  }
  await saveReaderNote(me.id, noted.id, { body: "Said my piece." });

  const prompts = await getNotePrompts(me.id);
  expect(prompts.map((book) => [book.title, book.returned])).toEqual([
    ["Piranesi", false],
    ["Circe", true],
  ]);
  expect(prompts[0].owner.firstname).toBe("Maya");
});

test("a book of your own you mark read asks what you thought, until you say", async () => {
  const me = await makeUser("Reader");
  const mine = await makeBook(me.id, "Middlemarch");
  expect(await getNotePrompts(me.id)).toEqual([]);

  await setRead(mine.id, me.id, true);
  const [prompt] = await getNotePrompts(me.id);
  expect(prompt).toMatchObject({ title: "Middlemarch", read: true, owner: { id: me.id } });

  // A heart isn't saying anything; a note is
  await saveReaderNote(me.id, mine.id, { loved: true });
  expect(await getNotePrompts(me.id)).toHaveLength(1);
  await saveReaderNote(me.id, mine.id, { body: "Slow, then wonderful." });
  expect(await getNotePrompts(me.id)).toEqual([]);
});

test("a longer page of the feed starts with the shorter one, so showing older adds below", async () => {
  const me = await makeUser("Reader");
  const friend = await makeUser("Friend");
  await createFriendship(me.id, friend.id);
  const DAY = 24 * 60 * 60 * 1000;
  for (let i = 0; i < 8; i++) {
    const book = await makeBook(friend.id, `Book ${i}`);
    // Far enough apart that each is its own post
    await prisma.book.update({
      where: { id: book.id },
      data: { createdAt: new Date(Date.now() - i * 10 * DAY) },
    });
    if (i % 2) {
      await prisma.readerNote.create({
        data: {
          bookId: book.id,
          userId: friend.id,
          loved: true,
          updatedAt: new Date(Date.now() - i * 10 * DAY - 3600_000),
        },
      });
    }
  }
  const short = await getFriendActivity(me.id, { days: 365, limit: 5 });
  const long = await getFriendActivity(me.id, { days: 365, limit: 10 });
  expect(short).toHaveLength(5);
  expect(long).toHaveLength(10);
  expect(long.slice(0, 5).map((item) => item.id)).toEqual(
    short.map((item) => item.id),
  );
  expect(new Set(long.map((item) => item.id)).size).toBe(10);
});

test("the feed can include your own written notes, but not your bare hearts", async () => {
  const { me, friend } = await setup();
  const borrowed = await makeBook(friend.id, "Piranesi");
  const hearted = await makeBook(friend.id, "Gilead");
  await saveReaderNote(me.id, borrowed.id, { body: "Strange and lovely." });
  await saveReaderNote(me.id, hearted.id, { loved: true });

  const mine = (items: Awaited<ReturnType<typeof getFriendActivity>>) =>
    items.filter((item) => item.kind !== "added" && item.friend.id === me.id);

  // Off by default, so the home page and weekly digest stay about friends
  expect(mine(await getFriendActivity(me.id))).toEqual([]);
  const own = mine(await getFriendActivity(me.id, { withOwnNotes: true }));
  expect(own).toHaveLength(1);
  expect(own[0]).toMatchObject({ kind: "note", body: "Strange and lovely." });
});

const fox = {
  key: "/works/OL45804W",
  title: "Fantastic Mr Fox",
  author: "Roald Dahl",
  cover: "",
};

test("a friend's note on a book read elsewhere is in the feed; bare hearts and read marks aren't", async () => {
  const { me, friend, stranger } = await setup();
  const sam = await makeUser("Sam");
  await createFriendship(me.id, sam.id);
  await saveWorkNote(friend.id, fox, {
    loved: true,
    body: "Read it to my niece.",
  });
  await saveWorkNote(
    sam.id,
    { ...fox, key: "/works/OL1W", title: "Hearted only" },
    { loved: true, read: true },
  );
  await saveWorkNote(stranger.id, fox, { body: "Not a friend" });
  // Two friends' copies of it, one out on loan
  const lent = await makeBook(sam.id, "Fantastic Mr Fox");
  const free = await makeBook(sam.id, "Fantastic Mr Fox");
  await prisma.book.updateMany({
    where: { id: { in: [lent.id, free.id] } },
    data: { openLibraryKey: fox.key },
  });
  await lendBook(lent.id, friend.id);

  const feed = await getFriendActivity(me.id);
  const notes = feed.filter((item) => item.kind === "elsewhere");
  expect(notes).toHaveLength(1);
  const [note] = notes;
  if (note.kind !== "elsewhere")
    throw new Error("Expected a note from elsewhere");
  expect(note).toMatchObject({
    friend: { firstname: "Maya" },
    work: { key: fox.key, title: "Fantastic Mr Fox" },
    loved: true,
    body: "Read it to my niece.",
  });
  // A copy that can be asked for comes first
  expect(note.viewer).toEqual({
    ownCopyId: null,
    wanted: false,
    copies: [
      {
        bookId: free.id,
        owner: { id: sam.id, firstname: "Sam" },
        available: true,
      },
      {
        bookId: lent.id,
        owner: { id: sam.id, firstname: "Sam" },
        available: false,
      },
    ],
  });

  // Once wanted, and once on your own shelf, it says so
  await addWantToRead(me.id, { ...fox, openLibraryKey: fox.key });
  const mine = await makeBook(me.id, "Fantastic Mr Fox");
  await prisma.book.update({
    where: { id: mine.id },
    data: { openLibraryKey: fox.key },
  });
  const [again] = (await getFriendActivity(me.id)).filter(
    (item) => item.kind === "elsewhere",
  );
  if (again.kind !== "elsewhere")
    throw new Error("Expected a note from elsewhere");
  expect(again.viewer).toMatchObject({ ownCopyId: mine.id, wanted: true });
});

test("a group's activity is only from the friends in it", async () => {
  const me = await makeUser("Me");
  const inGroup = await makeUser("Clubber");
  const elsewhere = await makeUser("Neighbor");
  await createFriendship(me.id, inGroup.id);
  await createFriendship(me.id, elsewhere.id);
  await makeBook(inGroup.id, "Club pick");
  await makeBook(elsewhere.id, "Not the club's");

  const all = await getFriendActivity(me.id);
  expect(all.map((item) => item.friend.id).sort()).toEqual([inGroup.id, elsewhere.id].sort());

  const group = await getFriendActivity(me.id, { among: [inGroup.id, me.id] });
  expect(group.map((item) => item.friend.id)).toEqual([inGroup.id]);
  // Nobody in common, nothing to show
  expect(await getFriendActivity(me.id, { among: [] })).toEqual([]);
});

test("a friend hidden from your feed drops out of it, and comes back when shown", async () => {
  const me = await makeUser("Me");
  const loud = await makeUser("Loud");
  const quiet = await makeUser("Quiet");
  await createFriendship(me.id, loud.id);
  await createFriendship(me.id, quiet.id);
  await makeBook(loud.id, "Another one");
  await makeBook(quiet.id, "Just one");

  await setHiddenFromFeed(me.id, loud.id, true);
  expect((await getFriendActivity(me.id)).map((item) => item.friend.id)).toEqual([quiet.id]);
  // Still a friend, shown as hidden on their card
  const cards = await getFriendCards(me.id);
  expect(cards.find((card) => card.id === loud.id)?.hiddenFromFeed).toBe(true);
  // Hiding is one way: they still see you
  await makeBook(me.id, "Mine");
  expect((await getFriendActivity(loud.id)).map((item) => item.friend.id)).toEqual([me.id]);

  await setHiddenFromFeed(me.id, loud.id, false);
  expect((await getFriendActivity(me.id)).map((item) => item.friend.id).sort()).toEqual([loud.id, quiet.id].sort());
});

test("a note on a borrowed book says whose copy it was", async () => {
  const { me, friend, stranger } = await setup();
  const hers = await makeBook(friend.id, "Circe");
  const mine = await makeBook(me.id, "Dune");
  const theirs = await makeBook(stranger.id, "Persuasion");
  await saveReaderNote(friend.id, hers.id, { body: "Mine." });
  await saveReaderNote(friend.id, mine.id, { body: "Yours." });
  await saveReaderNote(friend.id, theirs.id, { body: "Theirs." });

  const from = Object.fromEntries(
    (await getFriendActivity(me.id)).flatMap((item) =>
      item.kind === "note" ? [[item.book.title, item.from]] : [],
    ),
  );
  expect(from.Circe).toBeNull();
  expect(from.Dune).toMatchObject({ id: me.id, relation: "you", canAsk: false });
  expect(from.Persuasion).toMatchObject({
    id: stranger.id,
    name: "Stranger Reader",
    relation: "other",
    canAsk: true,
    asked: false,
  });
});

test("a lender who can't be found is named by first name and can't be asked", async () => {
  const { me, friend, stranger } = await setup();
  await prisma.user.update({ where: { id: stranger.id }, data: { discoverable: false } });
  const theirs = await makeBook(stranger.id, "Persuasion");
  await saveReaderNote(friend.id, theirs.id, { loved: true });

  const [item] = await getFriendActivity(me.id);
  expect(item.kind === "loved" && item.from).toMatchObject({ name: "Stranger", canAsk: false });
});

test("says when you already have a friend's book, want it or have read it", async () => {
  const { me, friend } = await setup();
  const mine = await makeBook(me.id, "Piranesi");
  const theirs = await makeBook(friend.id, "Piranesi");
  const wanted = await makeBook(friend.id, "Middlemarch");
  const read = await makeBook(friend.id, "Circe");
  const plain = await makeBook(friend.id, "Dune");
  await addWantToRead(me.id, { title: "Middlemarch", author: "", cover: "" });
  await lendBook(read.id, me.id);
  await prisma.book.update({ where: { id: read.id }, data: { borrowerId: null } });
  await prisma.lendingHistory.updateMany({ where: { bookId: read.id }, data: { returnedAt: new Date() } });

  const added = (await getFriendActivity(me.id)).find((item) => item.kind === "added");
  if (added?.kind !== "added") throw new Error("no additions");
  const viewer = (id: string) => added.books.find((book) => book.id === id)?.viewer;
  expect(viewer(theirs.id)).toMatchObject({ onShelf: true, wanted: false, readIt: false });
  expect(viewer(wanted.id)).toMatchObject({ onShelf: false, wanted: true });
  expect(viewer(read.id)).toMatchObject({ readIt: true });
  expect(viewer(plain.id)).toMatchObject({ onShelf: false, wanted: false, readIt: false });
  // Your own copy is what made theirs "on your shelf"
  expect(mine.title).toBe("Piranesi");
});
