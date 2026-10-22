// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { lendBook } from "./book.server";
import {
  acceptFriendInvite,
  answerFriendRequest,
  getFriendCards,
  getFriendInvite,
  getInviter,
  removeFriend,
} from "./friend.server";
import {
  createFriendship,
  createNotification,
  getFriendStatus,
  getReceivedNotification,
} from "./user.server";

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

test("a notification can only be looked up by the person it was sent to", async () => {
  const sender = await makeUser("Sender");
  const receiver = await makeUser("Receiver");
  const stranger = await makeUser("Stranger");
  const request = await createNotification(sender.id, receiver.id, "Sender Reader");

  expect(await getReceivedNotification(stranger.id, request.id)).toBeNull();
  expect(await getReceivedNotification(receiver.id, request.id)).toMatchObject({
    senderId: sender.id,
    type: "FRIEND_REQUEST",
  });
});

test("an invite link makes friends at once, and tells the inviter", async () => {
  const maya = await makeUser("Maya");
  const newcomer = await makeUser("Newcomer");
  await makeBook(maya.id, "Hamnet");
  const token = await getFriendInvite(maya.id);
  expect(await getFriendInvite(maya.id)).toBe(token);
  expect(await getInviter(token)).toMatchObject({ firstname: "Maya", bookCount: 1 });

  // A request already sent the other way is settled too
  await createNotification(newcomer.id, maya.id, "Newcomer Reader");

  expect(await acceptFriendInvite(newcomer.id, token)).toEqual({ ok: true, inviterId: maya.id });
  expect(await getFriendStatus(newcomer.id, maya.id)).toBe("friends");
  expect(await getFriendStatus(maya.id, newcomer.id)).toBe("friends");
  expect(
    await prisma.notification.count({
      where: { receiverId: maya.id, type: "FRIEND_JOINED", senderId: newcomer.id },
    }),
  ).toBe(1);
  expect(
    await prisma.notification.count({
      where: { receiverId: maya.id, type: "FRIEND_REQUEST", actionTaken: null },
    }),
  ).toBe(0);

  // Opening it again changes nothing
  expect(await acceptFriendInvite(newcomer.id, token)).toEqual({ ok: true, inviterId: maya.id });
  expect(await prisma.notification.count({ where: { receiverId: maya.id, type: "FRIEND_JOINED" } })).toBe(1);
});

test("invite links don't work on yourself, across the demo boundary, or once made up", async () => {
  const me = await makeUser("Me");
  const demo = await makeUser("Demo", { demoGroup: "invite-test" });
  const token = await getFriendInvite(me.id);
  expect(await acceptFriendInvite(me.id, token)).toEqual({ ok: false, reason: "own-invite" });
  expect(await acceptFriendInvite(demo.id, token)).toEqual({ ok: false, reason: "demo-boundary" });
  expect(await acceptFriendInvite(me.id, "not-a-token")).toEqual({ ok: false, reason: "no-such-invite" });
});
