import { prisma } from "~/db.server";
import type { Book, User } from "~/generated/prisma/client";

import { shelfIds } from "./household.server";
import { NOTE_MAX_LENGTH } from "./note.server";

// Hearts, read marks and notes on books that aren't on the reader's
// shelf. Hearts and notes are seen by their friends; the read mark is
// theirs alone.

export interface WorkSnapshot {
  key: string;
  title: string;
  author: string;
  cover: string;
}

const noteUser = {
  select: { id: true, firstname: true, surname: true, profileEmoji: true },
} as const;

async function friendIdsOf(userId: User["id"]) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { following: { select: { id: true } } },
  });
  return user?.following.map((friend) => friend.id) ?? [];
}

// Their own marks on this work, if any
export function getMyWorkNote(userId: User["id"], workKey: string) {
  return prisma.workNote.findUnique({
    where: { userId_workKey: { userId, workKey } },
    select: {
      id: true,
      loved: true,
      body: true,
      readAt: true,
      updatedAt: true,
      user: noteUser,
    },
  });
}

// Hearts and notes on this work from the reader and their friends: on
// copies friends have had, and on the book itself read elsewhere. Newest
// first, one per person (a note beats a bare heart).
export async function getWorkNotes(userId: User["id"], workKey: string) {
  const friendIds = await friendIdsOf(userId);
  const people = [userId, ...friendIds];
  const said = { OR: [{ loved: true }, { body: { not: null } }] };
  const [elsewhere, onCopies] = await Promise.all([
    prisma.workNote.findMany({
      where: { workKey, userId: { in: people }, ...said },
      select: {
        id: true,
        loved: true,
        body: true,
        updatedAt: true,
        user: noteUser,
      },
    }),
    prisma.readerNote.findMany({
      // Their own copy's notes stay on that copy's page
      where: {
        book: { openLibraryKey: workKey },
        userId: { in: friendIds },
        ...said,
      },
      select: {
        id: true,
        loved: true,
        body: true,
        updatedAt: true,
        user: noteUser,
      },
    }),
  ]);
  const byPerson = new Map<string, (typeof elsewhere)[number]>();
  for (const note of [...elsewhere, ...onCopies]) {
    const seen = byPerson.get(note.user.id);
    if (
      !seen ||
      (!seen.body && note.body) ||
      (Boolean(seen.body) === Boolean(note.body) &&
        note.updatedAt > seen.updatedAt)
    ) {
      byPerson.set(note.user.id, note);
    }
  }
  return [...byPerson.values()].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );
}

// Friends' hearts and notes on this work read elsewhere, for a copy's
// own page
export async function getFriendsWorkNotes(
  userId: User["id"],
  workKey: string,
  exceptIds: string[],
) {
  const friendIds = (await friendIdsOf(userId)).filter(
    (id) => !exceptIds.includes(id),
  );
  if (friendIds.length === 0) return [];
  return prisma.workNote.findMany({
    where: {
      workKey,
      userId: { in: friendIds },
      OR: [{ loved: true }, { body: { not: null } }],
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      loved: true,
      body: true,
      updatedAt: true,
      user: noteUser,
    },
  });
}

// Saves a heart, read mark or note; a row with nothing left on it goes
// keepTime is for an edit: the note keeps its time, so the feed leaves it
// where it was instead of posting it again as new
export async function saveWorkNote(
  userId: User["id"],
  work: WorkSnapshot,
  change: { loved?: boolean; body?: string | null; read?: boolean },
  { keepTime = false }: { keepTime?: boolean } = {},
) {
  const body =
    change.body === undefined
      ? undefined
      : change.body?.trim().slice(0, NOTE_MAX_LENGTH) || null;
  const readAt =
    change.read === undefined ? undefined : change.read ? new Date() : null;
  const snapshot = {
    title: work.title,
    author: work.author,
    cover: work.cover,
  };
  const where = { userId_workKey: { userId, workKey: work.key } };
  const was = keepTime
    ? await prisma.workNote.findUnique({ where, select: { updatedAt: true } })
    : null;
  const note = await prisma.workNote.upsert({
    where,
    create: {
      userId,
      workKey: work.key,
      ...snapshot,
      loved: change.loved ?? false,
      body: body ?? null,
      readAt: readAt ?? null,
    },
    update: {
      ...snapshot,
      loved: change.loved,
      body,
      readAt,
      ...(was ? { updatedAt: was.updatedAt } : {}),
    },
  });
  if (!note.loved && !note.body && !note.readAt) {
    await prisma.workNote.delete({ where: { id: note.id } });
    return null;
  }
  return note;
}

// Everything they've marked off their shelf, newest first
export function listMyWorkNotes(userId: User["id"]) {
  return prisma.workNote.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      workKey: true,
      title: true,
      author: true,
      cover: true,
      loved: true,
      body: true,
      readAt: true,
    },
  });
}

// Off your Also read: your read mark, heart and note on it, all gone
export async function removeWorkNote(userId: User["id"], id: string) {
  await prisma.workNote.deleteMany({ where: { id, userId } });
}

// What's saved of a work, for when Open Library doesn't answer
export function getWorkSnapshot(workKey: string) {
  return prisma.workNote.findFirst({
    where: { workKey },
    orderBy: { updatedAt: "desc" },
    select: { title: true, author: true, cover: true },
  });
}

// A book noted while it wasn't yours has joined your shelf (bought, given,
// imported, or just found on Open Library): the heart, read mark and note
// move onto your copy, so they're there when you open it, and the read-
// elsewhere one goes so it isn't shown twice. Anything already on the copy
// stays. Everyone sharing the shelf brings their own.
export async function adoptWorkNotes(bookId: Book["id"]) {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { userId: true, openLibraryKey: true },
  });
  if (!book?.openLibraryKey?.startsWith("/works/")) return;
  const notes = await prisma.workNote.findMany({
    where: {
      workKey: book.openLibraryKey,
      userId: { in: await shelfIds(book.userId) },
    },
  });
  for (const note of notes) {
    const where = { bookId_userId: { bookId, userId: note.userId } };
    const onCopy = await prisma.readerNote.findUnique({ where });
    await prisma.$transaction([
      prisma.readerNote.upsert({
        where,
        create: {
          bookId,
          userId: note.userId,
          loved: note.loved,
          body: note.body,
          readAt: note.readAt,
        },
        update: {
          loved: onCopy?.loved || note.loved,
          body: onCopy?.body ?? note.body,
          readAt: onCopy?.readAt ?? note.readAt,
        },
      }),
      prisma.workNote.delete({ where: { id: note.id } }),
    ]);
  }
}
