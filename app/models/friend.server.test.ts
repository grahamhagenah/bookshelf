// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { lendBook } from "./book.server";
import { answerFriendRequest, getFriendCards, removeFriend } from "./friend.server";
import { createFriendship, createNotification, getFriendStatus } from "./user.server";

test("a friend's card counts their shelf, the loans between you and your wishes", async () => {
  const me = await makeUser("Me");
  const maya = await makeUser("Maya");
  await createFriendship(me.id, maya.id);
  await makeBook(maya.id, "The Overstory");
  const theirs = await makeBook(maya.id, "Piranesi");
  const mine = await makeBook(me.id, "Circe");
  await lendBook(theirs.id, me.id);
  await lendBook(mine.id, maya.id);
  await prisma.wantToRead.create({ data: { userId: me.id, title: "The Overstory", author: "Richard Powers", cover: "" } });

  const [card] = await getFriendCards(me.id);
  expect(card).toMatchObject({
    id: maya.id,
    bookCount: 2,
    availableCount: 1,
    hasOfMine: 1,
    iHaveOfTheirs: 1,
    wanted: 1,
  });
  expect(card.recent.map((book) => book.title)).toEqual(
    expect.arrayContaining(["The Overstory", "Piranesi"]),
  );
});

test("removing a friend ends it both ways and gives up places in line", async () => {
  const me = await makeUser("Me");
  const sam = await makeUser("Sam");
  await createFriendship(me.id, sam.id);
  const theirs = await makeBook(sam.id, "Dune");
  const mine = await makeBook(me.id, "Emma");
  await prisma.hold.create({ data: { bookId: theirs.id, userId: me.id } });
  await prisma.hold.create({ data: { bookId: mine.id, userId: sam.id } });

  await removeFriend(me.id, sam.id);

  expect(await getFriendStatus(me.id, sam.id)).toBe("none");
  expect(await getFriendStatus(sam.id, me.id)).toBe("none");
  expect(await prisma.hold.count({ where: { bookId: { in: [theirs.id, mine.id] } } })).toBe(0);
  expect(await getFriendCards(me.id)).toEqual([]);
});

test("only the person a request was sent to can accept it", async () => {
  const sender = await makeUser("Sender");
  const receiver = await makeUser("Receiver");
  const stranger = await makeUser("Stranger");
  const request = await createNotification(sender.id, receiver.id, "Sender Reader");

  expect(await answerFriendRequest(stranger.id, request.id, true)).toBe(false);
  expect(await getFriendStatus(stranger.id, sender.id)).not.toBe("friends");

  expect(await answerFriendRequest(receiver.id, request.id, true)).toBe(true);
  expect(await getFriendStatus(receiver.id, sender.id)).toBe("friends");
});
