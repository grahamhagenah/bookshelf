import type { User } from "@prisma/client";

import { prisma } from "~/db.server";
import { isNotLending } from "~/lending";
import { friendLimitBetween } from "~/plan.server";
import { isDemoEmail } from "~/utils";
import { sameWork } from "~/works";

import { canInteract } from "./demo.server";
import { shelfIds, shelfIdsFor } from "./household.server";
import { createFriendship } from "./user.server";

// Friends, as the friends page shows them: who they are, what's on their
// shelf, which books are going back and forth between you, and the way
// out of a friendship.

const RECENT_COVERS = 5;

export async function getFriendCards(userId: User["id"]) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      following: {
        select: {
          id: true,
          firstname: true,
          surname: true,
          email: true,
          profileEmoji: true,
          household: { select: { members: { select: { id: true } } } },
        },
      },
    },
  });
  const friends = me?.following ?? [];
  if (friends.length === 0) return [];

  const friendIds = friends.map((friend) => friend.id);
  const [myShelf, theirShelves, wishes, accepted] = await Promise.all([
    shelfIds(userId),
    shelfIdsFor(friendIds),
    prisma.wantToRead.findMany({
      where: { userId },
      select: { title: true, openLibraryKey: true, isbn: true },
    }),
    // A friendship has no date of its own; the accepted request stands in
    prisma.notification.findMany({
      where: {
        type: "FRIEND_REQUEST",
        actionTaken: "accepted",
        OR: [
          { senderId: userId, receiverId: { in: friendIds } },
          { receiverId: userId, senderId: { in: friendIds } },
        ],
      },
      select: { senderId: true, receiverId: true, createdAt: true },
    }),
  ]);

  const [theirBooks, lentToThem] = await Promise.all([
    prisma.book.findMany({
      where: { userId: { in: theirShelves } },
      select: {
        id: true,
        title: true,
        author: true,
        cover: true,
        userId: true,
        borrowerId: true,
        notLendingUntil: true,
        openLibraryKey: true,
        isbn: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.book.findMany({
      where: { userId: { in: myShelf }, borrowerId: { in: friendIds } },
      select: { borrowerId: true },
    }),
  ]);

  return friends
    .map((friend) => {
      const shelf = new Set([
        friend.id,
        ...(friend.household?.members.map((m) => m.id) ?? []),
      ]);
      const books = theirBooks.filter((book) => shelf.has(book.userId));
      const since = accepted
        .filter((n) => n.senderId === friend.id || n.receiverId === friend.id)
        .map((n) => n.createdAt)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      return {
        id: friend.id,
        firstname: friend.firstname,
        surname: friend.surname,
        profileEmoji: friend.profileEmoji,
        email: isDemoEmail(friend.email) ? null : friend.email,
        since: since ?? null,
        bookCount: books.length,
        availableCount: books.filter(
          (book) => !book.borrowerId && !isNotLending(book.notLendingUntil),
        ).length,
        lastAddedAt: books[0]?.createdAt ?? null,
        recent: books
          .slice(0, RECENT_COVERS)
          .map(({ id, title, author, cover }) => ({
            id,
            title,
            author,
            cover,
          })),
        // Books going back and forth between the two of you
        hasOfMine: lentToThem.filter((book) => book.borrowerId === friend.id)
          .length,
        iHaveOfTheirs: books.filter((book) => book.borrowerId === userId)
          .length,
        // Books on your want-to-read list that they own
        wanted: wishes.filter((wish) =>
          books.some((book) => sameWork(wish, book)),
        ).length,
      };
    })
    .sort((a, b) => a.firstname.localeCompare(b.firstname));
}

// Requests other people have sent you that you haven't answered yet
export function getIncomingFriendRequests(userId: User["id"]) {
  return prisma.notification.findMany({
    where: { receiverId: userId, type: "FRIEND_REQUEST", actionTaken: null },
    select: {
      id: true,
      createdAt: true,
      sender: {
        select: {
          id: true,
          firstname: true,
          surname: true,
          profileEmoji: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

// Answers a request sent to this person, and only to them; the friend is
// whoever sent it. A request either side has no room for on the free plan
// stays waiting.
export async function answerFriendRequest(
  userId: User["id"],
  notificationId: string,
  accept: boolean,
) {
  const request = await prisma.notification.findFirst({
    where: { id: notificationId, receiverId: userId, type: "FRIEND_REQUEST" },
    select: { senderId: true },
  });
  if (!request) return "not-found" as const;
  if (accept) {
    const limit = await friendLimitBetween(userId, request.senderId);
    if (limit) return limit;
    await createFriendship(userId, request.senderId);
  }
  await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true, actionTaken: accept ? "accepted" : "declined" },
  });
  return "done" as const;
}

// Ends a friendship both ways. Books already lent stay lent until they come
// back; places in line for each other's books are given up.
export async function removeFriend(userId: User["id"], friendId: User["id"]) {
  const [myShelf, theirShelf] = await Promise.all([
    shelfIds(userId),
    shelfIds(friendId),
  ]);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        following: { disconnect: { id: friendId } },
        followedBy: { disconnect: { id: friendId } },
      },
    }),
    prisma.hold.deleteMany({
      where: {
        OR: [
          { userId, book: { userId: { in: theirShelf } } },
          { userId: friendId, book: { userId: { in: myShelf } } },
        ],
      },
    }),
  ]);
}

// Your personal invite link: anyone who opens it (signing up first if they
// need to) becomes your friend straight away. Made the first time it's
// asked for, then the same link from then on.
export async function getFriendInvite(userId: User["id"]) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { friendInvite: true },
  });
  if (user?.friendInvite) return user.friendInvite;
  const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
  await prisma.user.update({
    where: { id: userId },
    data: { friendInvite: token },
  });
  return token;
}

// Who a link belongs to, with a glimpse of their shelf for the welcome page
export async function getInviter(token: string) {
  const inviter = await prisma.user.findUnique({
    where: { friendInvite: token },
    select: { id: true, firstname: true, surname: true, profileEmoji: true },
  });
  if (!inviter) return null;
  const shelf = await shelfIds(inviter.id);
  const [bookCount, recent] = await Promise.all([
    prisma.book.count({ where: { userId: { in: shelf } } }),
    prisma.book.findMany({
      where: { userId: { in: shelf } },
      select: { id: true, title: true, author: true, cover: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);
  return { ...inviter, bookCount, recent };
}

export type InviteResult =
  | { ok: true; inviterId: string }
  | {
      ok: false;
      reason:
        | "no-such-invite"
        | "own-invite"
        | "demo-boundary"
        | "full"
        | "they-are-full";
    };

// Opening someone's invite: you're friends from now on, any request between
// you is settled, and they hear that you've joined
export async function acceptFriendInvite(
  userId: User["id"],
  token: string,
): Promise<InviteResult> {
  const inviter = await prisma.user.findUnique({
    where: { friendInvite: token },
    select: { id: true },
  });
  if (!inviter) return { ok: false, reason: "no-such-invite" };
  if (inviter.id === userId) return { ok: false, reason: "own-invite" };
  if (!(await canInteract(userId, inviter.id)))
    return { ok: false, reason: "demo-boundary" };

  const already = await prisma.user.count({
    where: { id: userId, following: { some: { id: inviter.id } } },
  });
  if (already) return { ok: true, inviterId: inviter.id };

  const limit = await friendLimitBetween(userId, inviter.id);
  if (limit) return { ok: false, reason: limit };

  await createFriendship(userId, inviter.id);
  await prisma.notification.updateMany({
    where: {
      type: "FRIEND_REQUEST",
      actionTaken: null,
      OR: [
        { senderId: userId, receiverId: inviter.id },
        { senderId: inviter.id, receiverId: userId },
      ],
    },
    data: { read: true, actionTaken: "accepted" },
  });
  const me = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { firstname: true, surname: true },
  });
  await prisma.notification.create({
    data: {
      type: "FRIEND_JOINED",
      senderId: userId,
      receiverId: inviter.id,
      senderName: `${me.firstname} ${me.surname}`,
    },
  });
  return { ok: true, inviterId: inviter.id };
}
