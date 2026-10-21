import type { User } from "@prisma/client";

import { prisma } from "~/db.server";

// What friends have been up to lately: books they've added, and hearts and
// notes they've left. Built from existing records, newest first.

const DAY = 24 * 60 * 60 * 1000;
// Additions this close together read as one batch: "Maya added 3 books"
const BATCH_WINDOW = 7 * DAY;

interface FeedPerson {
  id: string;
  firstname: string;
  surname: string;
  profileEmoji: string | null;
}

interface FeedBook {
  id: string;
  title: string;
  cover: string;
}

export type FriendActivity =
  | { kind: "added"; id: string; at: Date; friend: FeedPerson; books: FeedBook[] }
  | {
      kind: "loved" | "note";
      id: string;
      at: Date;
      friend: FeedPerson;
      book: FeedBook;
      loved: boolean;
      body: string | null;
    };

const person = {
  select: { id: true, firstname: true, surname: true, profileEmoji: true },
} as const;
const bookFields = { id: true, title: true, cover: true } as const;

export async function getFriendActivity(
  userId: User["id"],
  { days = 60, limit = 20 }: { days?: number; limit?: number } = {},
): Promise<FriendActivity[]> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { following: { select: { id: true } } },
  });
  const friendIds = me?.following.map((friend) => friend.id) ?? [];
  if (friendIds.length === 0) return [];

  const since = new Date(Date.now() - days * DAY);
  const [books, notes] = await Promise.all([
    prisma.book.findMany({
      where: { userId: { in: friendIds }, createdAt: { gte: since } },
      select: { ...bookFields, createdAt: true, user: person },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.readerNote.findMany({
      where: {
        userId: { in: friendIds },
        updatedAt: { gte: since },
        OR: [{ loved: true }, { body: { not: null } }],
      },
      select: {
        id: true,
        loved: true,
        body: true,
        updatedAt: true,
        user: person,
        book: { select: bookFields },
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
    }),
  ]);

  // Gather each friend's additions into batches, newest first
  const added: Extract<FriendActivity, { kind: "added" }>[] = [];
  const openBatch = new Map<string, (typeof added)[number]>();
  for (const { user, createdAt, ...book } of books) {
    if (!user) continue;
    const batch = openBatch.get(user.id);
    if (batch && batch.at.getTime() - createdAt.getTime() <= BATCH_WINDOW) {
      batch.books.push(book);
    } else {
      const next = {
        kind: "added" as const,
        id: `added-${book.id}`,
        at: createdAt,
        friend: user,
        books: [book],
      };
      added.push(next);
      openBatch.set(user.id, next);
    }
  }

  const reactions: FriendActivity[] = notes.map((note) => ({
    kind: note.body ? "note" : "loved",
    id: `note-${note.id}`,
    at: note.updatedAt,
    friend: note.user,
    book: note.book,
    loved: note.loved,
    body: note.body,
  }));

  return [...added, ...reactions]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
}
