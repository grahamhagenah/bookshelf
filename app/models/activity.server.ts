import { prisma } from "~/db.server";
import type { User } from "~/generated/prisma/client";
import { isNotLending } from "~/lending";

import { shelfIds } from "./household.server";

// What friends have been up to lately: books they've added, hearts and
// notes they've left on copies, and notes on books they read somewhere
// else. Built from existing records, newest first.

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
  // Its owner isn't lending it for now
  notLending: boolean;
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
  | {
      kind: "added";
      id: string;
      at: Date;
      friend: FeedPerson;
      books: FeedBook[];
    }
  | {
      kind: "loved" | "note";
      id: string;
      at: Date;
      friend: FeedPerson;
      book: FeedBook;
      loved: boolean;
      body: string | null;
      // Whose copy they read, when they borrowed it
      from: Lender | null;
    }
  | {
      // A note on a book read somewhere else: no copy to borrow from
      // them, so what's offered is wanting it, or a friend's copy
      kind: "elsewhere";
      id: string;
      at: Date;
      friend: FeedPerson;
      work: { key: string; title: string; author: string; cover: string };
      loved: boolean;
      body: string;
      viewer: {
        // Their own copy of it, if they have one
        ownCopyId: string | null;
        wanted: boolean;
        // Friends' copies, the ones that can be asked for first
        copies: {
          bookId: string;
          owner: { id: string; firstname: string };
          available: boolean;
        }[];
      };
    };

// The owner of a book a friend borrowed, as the person looking knows them:
// you, a friend of yours, or someone else. Someone else is named in full,
// and can be asked to be friends, only if they've chosen to be findable.
export interface Lender {
  id: string;
  name: string;
  relation: "you" | "friend" | "other";
  canAsk: boolean;
  // A friend request between you is already waiting
  asked: boolean;
}

const person = {
  select: { id: true, firstname: true, surname: true, profileEmoji: true },
} as const;
const bookFields = {
  id: true,
  title: true,
  author: true,
  cover: true,
  borrowerId: true,
  notLendingUntil: true,
  user: { select: { id: true, firstname: true } },
} as const;

function feedBook({
  borrowerId,
  notLendingUntil,
  user,
  ...book
}: {
  id: string;
  title: string;
  author: string;
  cover: string;
  borrowerId: string | null;
  notLendingUntil: Date | null;
  user: { id: string; firstname: string };
}): FeedBook {
  const notLending = isNotLending(notLendingUntil);
  return {
    ...book,
    owner: user,
    available: borrowerId === null && !notLending,
    notLending,
    borrowerId,
    loves: 0,
    notes: 0,
    viewer: {
      loved: false,
      canLove: false,
      canRequest: false,
      requested: false,
      inLine: false,
    },
  };
}

// Fill in the hearts, notes and the viewer's standing for every book in
// the feed, in a few queries rather than one per book
async function enrich(
  items: FriendActivity[],
  userId: User["id"],
  friendIds: string[],
) {
  await enrichElsewhere(items, userId, friendIds);
  const books = items.flatMap((item) =>
    item.kind === "added"
      ? item.books
      : item.kind === "elsewhere"
        ? []
        : [item.book],
  );
  const ids = [...new Set(books.map((book) => book.id))];
  if (ids.length === 0) return;

  const [notes, pastLoans, holds, requests] = await Promise.all([
    prisma.readerNote.findMany({
      where: {
        bookId: { in: ids },
        OR: [{ loved: true }, { body: { not: null } }],
      },
      select: { bookId: true, userId: true, loved: true, body: true },
    }),
    prisma.lendingHistory.findMany({
      where: { bookId: { in: ids }, borrowerId: userId },
      select: { bookId: true },
    }),
    prisma.hold.findMany({
      where: { bookId: { in: ids }, userId },
      select: { bookId: true },
    }),
    prisma.notification.findMany({
      where: {
        type: "BOOK_REQUEST",
        senderId: userId,
        bookId: { in: ids },
        read: false,
      },
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

// For notes on books read elsewhere: whether the viewer has it, wants it,
// or can borrow it from a friend
async function enrichElsewhere(
  items: FriendActivity[],
  userId: User["id"],
  friendIds: string[],
) {
  const notes = items.filter(
    (item): item is Extract<FriendActivity, { kind: "elsewhere" }> =>
      item.kind === "elsewhere",
  );
  const keys = [...new Set(notes.map((item) => item.work.key))];
  if (keys.length === 0) return;
  const [own, wants, copies] = await Promise.all([
    prisma.book.findMany({
      where: {
        userId: { in: await shelfIds(userId) },
        openLibraryKey: { in: keys },
      },
      select: { id: true, openLibraryKey: true },
    }),
    prisma.wantToRead.findMany({
      where: { userId, openLibraryKey: { in: keys } },
      select: { openLibraryKey: true },
    }),
    prisma.book.findMany({
      where: { userId: { in: friendIds }, openLibraryKey: { in: keys } },
      select: {
        id: true,
        openLibraryKey: true,
        borrowerId: true,
        notLendingUntil: true,
        user: { select: { id: true, firstname: true } },
      },
    }),
  ]);
  for (const item of notes) {
    item.viewer = {
      ownCopyId:
        own.find((book) => book.openLibraryKey === item.work.key)?.id ?? null,
      wanted: wants.some((wish) => wish.openLibraryKey === item.work.key),
      copies: copies
        .filter((book) => book.openLibraryKey === item.work.key)
        .map((book) => ({
          bookId: book.id,
          owner: book.user,
          available:
            book.borrowerId === null && !isNotLending(book.notLendingUntil),
        }))
        .sort((a, b) => Number(b.available) - Number(a.available)),
    };
  }
}

// withOwnNotes adds the viewer's own written notes (not bare hearts), so
// a note posted from the feed shows up there as friends will see it.
// among narrows it to some of your friends, such as the people in a group.
export async function getFriendActivity(
  userId: User["id"],
  {
    days = 60,
    limit = 20,
    withOwnNotes = false,
    among,
  }: { days?: number; limit?: number; withOwnNotes?: boolean; among?: string[] } = {},
): Promise<FriendActivity[]> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      following: { select: { id: true } },
      feedMutes: { select: { mutedId: true } },
    },
  });
  const friendIds = me?.following.map((friend) => friend.id) ?? [];
  // Whose activity this is, less anyone you've hidden from your feed;
  // who's a friend still decides what you can ask for
  const hidden = new Set(me?.feedMutes.map((mute) => mute.mutedId));
  const sourceIds = (among ? friendIds.filter((id) => among.includes(id)) : friendIds).filter(
    (id) => !hidden.has(id),
  );
  if (sourceIds.length === 0) return [];

  const since = new Date(Date.now() - days * DAY);
  const [books, notes, elsewhere] = await Promise.all([
    prisma.book.findMany({
      where: { userId: { in: sourceIds }, createdAt: { gte: since } },
      select: { ...bookFields, createdAt: true, user: person },
      orderBy: { createdAt: "desc" },
      // Several books can share one post, so look a good way back
      take: Math.max(200, limit * 5),
    }),
    prisma.readerNote.findMany({
      where: {
        updatedAt: { gte: since },
        OR: [
          {
            userId: { in: sourceIds },
            OR: [{ loved: true }, { body: { not: null } }],
          },
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
    // Notes on books read somewhere else; bare hearts and read marks
    // stay out of the feed
    prisma.workNote.findMany({
      where: {
        updatedAt: { gte: since },
        body: { not: null },
        userId: { in: withOwnNotes ? [...sourceIds, userId] : sourceIds },
      },
      select: {
        id: true,
        workKey: true,
        title: true,
        author: true,
        cover: true,
        loved: true,
        body: true,
        updatedAt: true,
        user: person,
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
    from: null,
  }));

  const readElsewhere: FriendActivity[] = elsewhere.map((note) => ({
    kind: "elsewhere",
    id: `elsewhere-${note.id}`,
    at: note.updatedAt,
    friend: note.user,
    work: {
      key: note.workKey,
      title: note.title,
      author: note.author,
      cover: note.cover,
    },
    loved: note.loved,
    body: note.body ?? "",
    viewer: { ownCopyId: null, wanted: false, copies: [] },
  }));

  const feed = [...added, ...reactions, ...readElsewhere]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
  await enrich(feed, userId, friendIds);
  await addLenders(feed, userId, friendIds);
  return feed;
}

// Who lent each book a friend loved or wrote about: its owner, when that's
// neither them nor someone they share a shelf with
async function addLenders(
  items: FriendActivity[],
  userId: User["id"],
  friendIds: string[],
) {
  const reactions = items.filter(
    (item): item is Extract<FriendActivity, { kind: "loved" | "note" }> =>
      item.kind === "loved" || item.kind === "note",
  );
  if (reactions.length === 0) return;
  const ids = [...new Set(reactions.flatMap((item) => [item.friend.id, item.book.owner.id]))];
  const [people, me, requests] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        firstname: true,
        surname: true,
        householdId: true,
        discoverable: true,
        demoGroup: true,
      },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { demoGroup: true } }),
    prisma.notification.findMany({
      where: {
        type: "FRIEND_REQUEST",
        actionTaken: null,
        OR: [
          { senderId: userId, receiverId: { in: ids } },
          { receiverId: userId, senderId: { in: ids } },
        ],
      },
      select: { senderId: true, receiverId: true },
    }),
  ]);
  const byId = new Map(people.map((p) => [p.id, p]));
  const asked = new Set(requests.flatMap((r) => [r.senderId, r.receiverId]));
  for (const item of reactions) {
    const owner = byId.get(item.book.owner.id);
    const reader = byId.get(item.friend.id);
    if (!owner || !reader || owner.id === reader.id) continue;
    if (owner.householdId && owner.householdId === reader.householdId) continue;
    const relation =
      owner.id === userId ? "you" : friendIds.includes(owner.id) ? "friend" : "other";
    const known = relation !== "other" || owner.discoverable;
    item.from = {
      id: owner.id,
      name: known ? `${owner.firstname} ${owner.surname}` : owner.firstname,
      relation,
      canAsk: relation === "other" && owner.discoverable && owner.demoGroup === me?.demoGroup,
      asked: asked.has(owner.id),
    };
  }
}

// Books you've borrowed, now or lately, that you haven't written about:
// something to say to the next reader
export async function getNotePrompts(
  userId: User["id"],
  { days = 90, limit = 3 } = {},
) {
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
    .filter(
      (book) => !noted.has(book.id) && !seen.has(book.id) && seen.add(book.id),
    )
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  return prompts.slice(0, limit);
}
