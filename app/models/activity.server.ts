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
  author: string;
  cover: string;
  // Whose copy it is, and whether it's on their shelf right now
  owner: { id: string; firstname: string };
  available: boolean;
  borrowerId: string | null;
  // Hearts and written notes on this copy, from everyone
  loves: number;
  notes: number;
  // Where the person looking stands with this copy
  viewer: {
    loved: boolean;
    // Only readers of a copy (owner, borrower, past borrower) can heart it
    canLove: boolean;
    // A friend's copy they could ask for, or wait for
    canRequest: boolean;
    requested: boolean;
    inLine: boolean;
  };
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
const bookFields = {
  id: true,
  title: true,
  author: true,
  cover: true,
  borrowerId: true,
  user: { select: { id: true, firstname: true } },
} as const;

function feedBook({
  borrowerId,
  user,
  ...book
}: {
  id: string;
  title: string;
  author: string;
  cover: string;
  borrowerId: string | null;
  user: { id: string; firstname: string };
}): FeedBook {
  return {
    ...book,
    owner: user,
    available: borrowerId === null,
    borrowerId,
    loves: 0,
    notes: 0,
    viewer: { loved: false, canLove: false, canRequest: false, requested: false, inLine: false },
  };
}

// Fill in the hearts, notes and the viewer's standing for every book in
// the feed, in a few queries rather than one per book
async function enrich(items: FriendActivity[], userId: User["id"], friendIds: string[]) {
  const books = items.flatMap((item) => (item.kind === "added" ? item.books : [item.book]));
  const ids = [...new Set(books.map((book) => book.id))];
  if (ids.length === 0) return;

  const [notes, pastLoans, holds, requests] = await Promise.all([
    prisma.readerNote.findMany({
      where: { bookId: { in: ids }, OR: [{ loved: true }, { body: { not: null } }] },
      select: { bookId: true, userId: true, loved: true, body: true },
    }),
    prisma.lendingHistory.findMany({
      where: { bookId: { in: ids }, borrowerId: userId },
      select: { bookId: true },
    }),
    prisma.hold.findMany({ where: { bookId: { in: ids }, userId }, select: { bookId: true } }),
    prisma.notification.findMany({
      where: { type: "BOOK_REQUEST", senderId: userId, bookId: { in: ids }, read: false },
      select: { bookId: true },
    }),
  ]);
  const read = new Set(pastLoans.map((loan) => loan.bookId));
  const waiting = new Set(holds.map((hold) => hold.bookId));
  const asked = new Set(requests.map((request) => request.bookId));

  for (const book of books) {
    const own = notes.filter((note) => note.bookId === book.id);
    const mine = own.find((note) => note.userId === userId);
    book.loves = own.filter((note) => note.loved).length;
    book.notes = own.filter((note) => note.body).length;
    const isOwner = book.owner.id === userId;
    const isBorrower = book.borrowerId === userId;
    book.viewer = {
      loved: mine?.loved ?? false,
      canLove: isOwner || isBorrower || read.has(book.id),
      canRequest: !isOwner && !isBorrower && friendIds.includes(book.owner.id),
      requested: asked.has(book.id),
      inLine: waiting.has(book.id),
    };
  }
}

// withOwnNotes adds the viewer's own written notes (not bare hearts), so
// a note posted from the feed shows up there as friends will see it
export async function getFriendActivity(
  userId: User["id"],
  {
    days = 60,
    limit = 20,
    withOwnNotes = false,
  }: { days?: number; limit?: number; withOwnNotes?: boolean } = {},
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
      // Several books can share one post, so look a good way back
      take: Math.max(200, limit * 5),
    }),
    prisma.readerNote.findMany({
      where: {
        updatedAt: { gte: since },
        OR: [
          { userId: { in: friendIds }, OR: [{ loved: true }, { body: { not: null } }] },
          ...(withOwnNotes ? [{ userId, body: { not: null } }] : []),
        ],
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
  for (const { user, createdAt, ...rest } of books) {
    if (!user) continue;
    const book = feedBook({ ...rest, user });
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
    book: feedBook(note.book),
    loved: note.loved,
    body: note.body,
  }));

  const feed = [...added, ...reactions]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
  await enrich(feed, userId, friendIds);
  return feed;
}

// Books you've borrowed, now or lately, that you haven't written about:
// something to say to the next reader
export async function getNotePrompts(userId: User["id"], { days = 90, limit = 3 } = {}) {
  const since = new Date(Date.now() - days * DAY);
  const fields = {
    id: true,
    title: true,
    author: true,
    cover: true,
    user: { select: { id: true, firstname: true } },
  } as const;
  const [current, past, written] = await Promise.all([
    prisma.book.findMany({
      where: { borrowerId: userId },
      select: { ...fields, borrowedAt: true },
      orderBy: { borrowedAt: "desc" },
    }),
    prisma.lendingHistory.findMany({
      where: { borrowerId: userId, returnedAt: { gte: since } },
      select: { returnedAt: true, book: { select: fields } },
      orderBy: { returnedAt: "desc" },
    }),
    prisma.readerNote.findMany({
      where: { userId, body: { not: null } },
      select: { bookId: true },
    }),
  ]);
  const noted = new Set(written.map((note) => note.bookId));
  const seen = new Set<string>();
  const prompts = [
    ...current.map(({ borrowedAt, user, ...book }) => ({
      ...book,
      owner: user,
      returned: false,
      at: borrowedAt ?? new Date(0),
    })),
    ...past.map(({ returnedAt, book: { user, ...book } }) => ({
      ...book,
      owner: user,
      returned: true,
      at: returnedAt ?? new Date(0),
    })),
  ]
    .filter((book) => !noted.has(book.id) && !seen.has(book.id) && seen.add(book.id))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  return prompts.slice(0, limit);
}
