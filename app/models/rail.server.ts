import { prisma } from "~/db.server";
import type { User } from "~/generated/prisma/client";
import { workPath } from "~/utils";
import { sameWork } from "~/works";

import { shelfIds, shelfIdsFor } from "./household.server";
import { getWantToRead } from "./wish.server";

// More for the rail beside the feed: books you want that a friend has,
// what friends have loved lately, and people your friends know

const DAY = 24 * 60 * 60 * 1000;

const person = {
  select: { id: true, firstname: true, surname: true, profileEmoji: true },
} as const;

// Books on your want-to-read list that a friend has, each with the copy to
// ask for: one that's on its shelf now if there is one, then one that's
// out, and last one its owner isn't lending for now
export async function getWantedAtFriends(userId: User["id"], limit = 4) {
  const wishes = await getWantToRead(userId);
  return wishes
    .filter((wish) => wish.copies.length > 0)
    .slice(0, limit)
    .map((wish) => {
      const copy =
        wish.copies.find((c) => c.available) ??
        wish.copies.find((c) => !c.notLending) ??
        wish.copies[0];
      return {
        id: wish.id,
        title: wish.title,
        author: wish.author,
        cover: wish.cover,
        bookId: copy.bookId,
        owner: copy.owner.firstname,
        available: copy.available,
        notLending: copy.notLending,
        // Other friends with a copy
        others: wish.copies.filter((c) => c.owner.id !== copy.owner.id).length,
      };
    });
}

// The books friends have hearted lately, most hearts first, each with who
// loved it and where to open it: your copy or a friend's, or failing those
// the book's own page. Friends hidden from your feed are left out here too.
export async function getLovedByFriends(
  userId: User["id"],
  { days = 90, limit = 4 }: { days?: number; limit?: number } = {},
) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      following: { select: { id: true } },
      feedMutes: { select: { mutedId: true } },
    },
  });
  const friendIds = me?.following.map((friend) => friend.id) ?? [];
  const hidden = new Set(me?.feedMutes.map((mute) => mute.mutedId));
  const sourceIds = friendIds.filter((id) => !hidden.has(id));
  if (sourceIds.length === 0) return [];

  const since = new Date(Date.now() - days * DAY);
  const [onCopies, elsewhere, mine, theirs] = await Promise.all([
    prisma.readerNote.findMany({
      where: { userId: { in: sourceIds }, loved: true, updatedAt: { gte: since } },
      select: {
        updatedAt: true,
        user: person,
        book: {
          select: { title: true, author: true, cover: true, openLibraryKey: true, isbn: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    prisma.workNote.findMany({
      where: {
        userId: { in: sourceIds },
        loved: true,
        updatedAt: { gte: since },
        // Imported ones Open Library hasn't placed have no page to open
        workKey: { startsWith: "/works/" },
      },
      select: {
        updatedAt: true,
        user: person,
        workKey: true,
        title: true,
        author: true,
        cover: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
    }),
    shelfIds(userId),
    shelfIdsFor(friendIds),
  ]);

  const hearts = [
    ...onCopies.map((note) => ({ at: note.updatedAt, friend: note.user, work: note.book })),
    ...elsewhere.map((note) => ({
      at: note.updatedAt,
      friend: note.user,
      work: {
        title: note.title,
        author: note.author,
        cover: note.cover,
        openLibraryKey: note.workKey,
        isbn: null,
      },
    })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime());

  // One entry a book, however many copies or editions were hearted
  const picks: ((typeof hearts)[number]["work"] & {
    at: Date;
    friends: (typeof hearts)[number]["friend"][];
  })[] = [];
  for (const { at, friend, work } of hearts) {
    const pick = picks.find((other) => sameWork(other, work));
    if (!pick) picks.push({ ...work, at, friends: [friend] });
    else if (!pick.friends.some((other) => other.id === friend.id)) pick.friends.push(friend);
  }
  const top = picks
    .sort((a, b) => b.friends.length - a.friends.length || b.at.getTime() - a.at.getTime())
    .slice(0, limit);
  if (top.length === 0) return [];

  // Copies you can open, yours first
  const copies = await prisma.book.findMany({
    where: { userId: { in: [...mine, ...theirs] } },
    select: { id: true, title: true, openLibraryKey: true, isbn: true, userId: true },
  });
  copies.sort((a, b) => Number(mine.includes(b.userId)) - Number(mine.includes(a.userId)));

  return top.map(({ title, author, cover, openLibraryKey, isbn, friends }) => {
    const copy = copies.find((book) => sameWork(book, { title, openLibraryKey, isbn }));
    return {
      title,
      author,
      cover,
      friends,
      href: copy ? `/books/${copy.id}` : workPath(openLibraryKey),
    };
  });
}

// Your friends' friends you could add, most friends in common first: only
// people who've chosen to be findable, and nobody you've already asked or
// been asked by, either way it went
export async function getFriendsOfFriends(userId: User["id"], limit = 3) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      demoGroup: true,
      following: {
        select: { id: true, firstname: true, following: { select: { id: true } } },
        orderBy: { firstname: "asc" },
      },
    },
  });
  if (!me || me.following.length === 0) return [];

  const [housemates, asked] = await Promise.all([
    shelfIds(userId),
    prisma.notification.findMany({
      where: {
        type: "FRIEND_REQUEST",
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      select: { senderId: true, receiverId: true },
    }),
  ]);
  const skip = new Set([
    userId,
    ...housemates,
    ...me.following.map((friend) => friend.id),
    ...asked.flatMap((request) => [request.senderId, request.receiverId]),
  ]);

  // Who each of them knows through you: your friends' first names
  const through = new Map<string, string[]>();
  for (const friend of me.following) {
    for (const { id } of friend.following) {
      if (skip.has(id)) continue;
      through.set(id, [...(through.get(id) ?? []), friend.firstname]);
    }
  }
  if (through.size === 0) return [];

  const people = await prisma.user.findMany({
    where: {
      id: { in: [...through.keys()] },
      discoverable: true,
      demoGroup: me.demoGroup,
      // Still waiting on a loan email: not on Stacks yet
      invitedAt: null,
    },
    select: { id: true, firstname: true, surname: true, profileEmoji: true },
  });
  return people
    .map((user) => ({ ...user, through: through.get(user.id) ?? [] }))
    .sort(
      (a, b) =>
        b.through.length - a.through.length || a.firstname.localeCompare(b.firstname),
    )
    .slice(0, limit);
}
