// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { getPopularWithFriends } from "./popular.server";
import { createFriendship } from "./user.server";

// A past loan of a copy, a given number of days ago
const lent = (bookId: string, borrowerId: string, daysAgo: number) =>
  prisma.lendingHistory.create({
    data: {
      bookId,
      borrowerId,
      borrowedAt: new Date(Date.now() - daysAgo * 86_400_000),
      returnedAt: new Date(Date.now() - (daysAgo - 7) * 86_400_000),
    },
  });

test("friends' most lent books, counted per book, newest first on a tie", async () => {
  const me = await makeUser("Me");
  const maya = await makeUser("Maya");
  const sam = await makeUser("Sam");
  const reader = await makeUser("Reader");
  await createFriendship(me.id, maya.id);
  await createFriendship(me.id, sam.id);

  // Two friends' copies of one book count together
  const mayaDune = await makeBook(maya.id, "Dune");
  const samDune = await makeBook(sam.id, "Dune");
  await lent(mayaDune.id, reader.id, 90);
  await lent(samDune.id, reader.id, 60);
  await lent(samDune.id, maya.id, 30);
  // Two loans each: the more recent leads
  const circe = await makeBook(maya.id, "Circe");
  await lent(circe.id, reader.id, 50);
  await lent(circe.id, sam.id, 10);
  const piranesi = await makeBook(sam.id, "Piranesi");
  await lent(piranesi.id, reader.id, 40);
  await lent(piranesi.id, maya.id, 20);
  // Never lent: not shown
  await makeBook(maya.id, "Middlemarch");

  const popular = await getPopularWithFriends(me.id);
  expect(popular.map((book) => [book.title, book.loans])).toEqual([
    ["Dune", 3],
    ["Circe", 2],
    ["Piranesi", 2],
  ]);
  // The copy to ask for, and who has one
  const dune = popular[0];
  expect([mayaDune.id, samDune.id]).toContain(dune.id);
  expect(dune.owners.sort()).toEqual(["Maya", "Sam"]);
});

test("only books new to you, and only friends' copies", async () => {
  const me = await makeUser("Me");
  const maya = await makeUser("Maya");
  const stranger = await makeUser("Stranger");
  const reader = await makeUser("Reader");
  await createFriendship(me.id, maya.id);

  // Already on my shelf
  await makeBook(me.id, "Dune");
  const theirDune = await makeBook(maya.id, "Dune");
  await lent(theirDune.id, reader.id, 30);
  // Borrowed it myself before
  const circe = await makeBook(maya.id, "Circe");
  await lent(circe.id, me.id, 30);
  await lent(circe.id, reader.id, 10);
  // A stranger's much-lent book
  const strangers = await makeBook(stranger.id, "Piranesi");
  await lent(strangers.id, reader.id, 30);
  await lent(strangers.id, maya.id, 20);
  // New to me
  const hamnet = await makeBook(maya.id, "Hamnet");
  await lent(hamnet.id, reader.id, 5);

  expect((await getPopularWithFriends(me.id)).map((book) => book.title)).toEqual(["Hamnet"]);
  // No friends, nothing
  expect(await getPopularWithFriends(stranger.id)).toEqual([]);
});
