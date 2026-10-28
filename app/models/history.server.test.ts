// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { lendBook, returnBook } from "./book.server";
import { getHistory, getShelfCounts } from "./history.server";
import { createFriendship } from "./user.server";

test("history lists books you borrowed and lent once they're back, newest first, with the notes on them", async () => {
  const me = await makeUser("Me");
  const priya = await makeUser("Priya");
  const maya = await makeUser("Maya");
  await createFriendship(me.id, priya.id);
  await createFriendship(me.id, maya.id);

  const theirs = await makeBook(priya.id, "Piranesi");
  await lendBook(theirs.id, me.id);
  await returnBook(theirs.id);
  await prisma.readerNote.create({ data: { bookId: theirs.id, userId: me.id, body: "Strange and lovely." } });

  const mine = await makeBook(me.id, "Circe");
  await lendBook(mine.id, maya.id);
  await prisma.readerNote.create({ data: { bookId: mine.id, userId: maya.id, loved: true } });

  // Still out: on your shelf, not yet history
  expect((await getHistory(me.id)).map((entry) => entry.book.title)).toEqual(["Piranesi"]);
  expect((await getShelfCounts(me.id)).history).toBe(1);

  await returnBook(mine.id);
  const history = await getHistory(me.id);
  expect(history.map((entry) => [entry.kind, entry.book.title, entry.person.firstname])).toEqual([
    ["lent", "Circe", "Maya"],
    ["borrowed", "Piranesi", "Priya"],
  ]);
  expect(history[0].note).toMatchObject({ loved: true });
  expect(history[1].returnedAt).not.toBeNull();
  expect(history[1].note).toMatchObject({ body: "Strange and lovely." });

  expect(await getShelfCounts(me.id)).toEqual({ library: 1, want: 0, elsewhere: 0, history: 2 });
});
