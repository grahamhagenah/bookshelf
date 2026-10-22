// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { getFriendActivity } from "./activity.server";
import { saveReaderNote } from "./note.server";
import { createFriendship } from "./user.server";

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

async function bookAddedAt(userId: string, title: string, at: Date) {
  const book = await makeBook(userId, title);
  return prisma.book.update({ where: { id: book.id }, data: { createdAt: at } });
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
      ? [{ friend: item.friend.id, titles: item.books.map((book) => book.title) }]
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
  await saveReaderNote(stranger.id, book.id, { loved: true, body: "Not a friend" });
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
  expect(note).toMatchObject({ body: "Gorgeous.", loved: true, book: { title: "Circe" } });
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
    item.kind === "added" ? item.books.map((b) => b.title).join() : item.book.title,
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
  const seen = item.kind === "added" ? item.books[0] : item.book;
  expect(seen).toMatchObject({ loves: 2, notes: 1, available: true });
  // Not a reader of this copy, but a friend of its owner
  expect(seen.viewer).toEqual({
    loved: false,
    canLove: false,
    canRequest: true,
    requested: false,
    inLine: false,
  });
});
