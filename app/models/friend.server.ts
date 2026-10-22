import type { User } from "@prisma/client";

import { prisma } from "~/db.server";
import { isDemoEmail } from "~/utils";
import { sameWork } from "~/works";

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
      const shelf = new Set([friend.id, ...(friend.household?.members.map((m) => m.id) ?? [])]);
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
        availableCount: books.filter((book) => !book.borrowerId).length,
        lastAddedAt: books[0]?.createdAt ?? null,
        recent: books.slice(0, RECENT_COVERS).map(({ id, title, author, cover }) => ({
          id,
          title,
          author,
          cover,
        })),
        // Books going back and forth between the two of you
        hasOfMine: lentToThem.filter((book) => book.borrowerId === friend.id).length,
        iHaveOfTheirs: books.filter((book) => book.borrowerId === userId).length,
        // Books on your want-to-read list that they own
        wanted: wishes.filter((wish) => books.some((book) => sameWork(wish, book))).length,
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
      sender: { select: { id: true, firstname: true, surname: true, profileEmoji: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// Answers a request sent to this person, and only to them; the friend is
// whoever sent it
export async function answerFriendRequest(
  userId: User["id"],
  notificationId: string,
  accept: boolean,
) {
  const request = await prisma.notification.findFirst({
    where: { id: notificationId, receiverId: userId, type: "FRIEND_REQUEST" },
    select: { senderId: true },
  });
  if (!request) return false;
  if (accept) await createFriendship(userId, request.senderId);
  await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true, actionTaken: accept ? "accepted" : "declined" },
  });
  return true;
}

// Ends a friendship both ways. Books already lent stay lent until they come
// back; places in line for each other's books are given up.
export async function removeFriend(userId: User["id"], friendId: User["id"]) {
  const [myShelf, theirShelf] = await Promise.all([shelfIds(userId), shelfIds(friendId)]);
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
