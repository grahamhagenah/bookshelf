import { prisma } from "~/db.server";
import type { Book, User } from "~/generated/prisma/client";
import { isNotLending } from "~/lending";
import type { Work } from "~/works";
import { sameWork } from "~/works";

import { createBook } from "./book.server";
import { shelfIdsFor } from "./household.server";
import { saveWorkNote } from "./work-note.server";

export { normalizeTitle, sameWork } from "~/works";

// Your want-to-read list: books you don't own but would like to. Stacks
// watches your friends' shelves for them.

const person = {
  select: { id: true, firstname: true, surname: true },
} as const;

// Work keys and titles on the list, so search results can say so
export async function getWantToReadWorks(userId: User["id"]) {
  return prisma.wantToRead.findMany({
    where: { userId },
    select: { title: true, openLibraryKey: true, isbn: true },
  });
}

async function friendIdsOf(userId: User["id"]) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { following: { select: { id: true } } },
  });
  return user?.following.map((friend) => friend.id) ?? [];
}

// Everything on the list, newest first, with the friends who have a copy
export async function getWantToRead(userId: User["id"]) {
  const [wishes, friendIds] = await Promise.all([
    prisma.wantToRead.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    }),
    friendIdsOf(userId),
  ]);
  const friendBooks =
    wishes.length && friendIds.length
      ? await prisma.book.findMany({
          where: { userId: { in: await shelfIdsFor(friendIds) } },
          select: {
            id: true,
            title: true,
            openLibraryKey: true,
            isbn: true,
            borrowerId: true,
            notLendingUntil: true,
            user: person,
          },
        })
      : [];

  return wishes.map((wish) => ({
    ...wish,
    copies: friendBooks
      .filter((book) => sameWork(wish, book))
      .map((book) => ({
        bookId: book.id,
        owner: book.user,
        available:
          book.borrowerId === null && !isNotLending(book.notLendingUntil),
        notLending: isNotLending(book.notLendingUntil),
      })),
  }));
}

export async function isOnWantToRead(userId: User["id"], work: Work) {
  const wishes = await getWantToReadWorks(userId);
  return wishes.some((wish) => sameWork(wish, work));
}

export async function addWantToRead(
  userId: User["id"],
  book: Work & { author: string; cover: string },
) {
  if (await isOnWantToRead(userId, book)) return null;
  return prisma.wantToRead.create({
    data: {
      userId,
      title: book.title,
      author: book.author,
      cover: book.cover,
      openLibraryKey: book.openLibraryKey ?? null,
      isbn: book.isbn ?? null,
    },
  });
}

// Off your list, from the book's own page: however it got on, by its
// Open Library work or its title
export async function removeWantedWork(userId: User["id"], work: Work) {
  const wishes = await prisma.wantToRead.findMany({
    where: { userId },
    select: { id: true, title: true, openLibraryKey: true, isbn: true },
  });
  const ids = wishes.filter((wish) => sameWork(wish, work)).map((wish) => wish.id);
  if (ids.length) await prisma.wantToRead.deleteMany({ where: { id: { in: ids }, userId } });
  return ids.length;
}

// One book on your list
export function getWish(id: string, userId: User["id"]) {
  return prisma.wantToRead.findFirst({ where: { id, userId } });
}

// The Open Library work for a book on your list that came without one
// (from an import, or the demo's list), as a friend's copy of it already
// knows it. Using theirs keeps the two matched: once both have a key, only
// the same key counts, and Open Library has duplicate works.
export async function workKeyFromFriends(userId: User["id"], wish: Work) {
  const friendIds = await friendIdsOf(userId);
  if (friendIds.length === 0) return null;
  const books = await prisma.book.findMany({
    where: {
      userId: { in: await shelfIdsFor(friendIds) },
      openLibraryKey: { startsWith: "/works/" },
    },
    select: { title: true, openLibraryKey: true, isbn: true },
  });
  const match = books.find((book) =>
    sameWork({ ...wish, openLibraryKey: null }, book),
  );
  return match?.openLibraryKey ?? null;
}

// Remembers the work found for a book on your list, so it's asked once
export function setWishWork(
  id: string,
  userId: User["id"],
  openLibraryKey: string,
) {
  return prisma.wantToRead.updateMany({
    where: { id, userId },
    data: { openLibraryKey },
  });
}

export function removeWantToRead(id: string, userId: User["id"]) {
  return prisma.wantToRead.deleteMany({ where: { id, userId } });
}

// Off your shelf and onto your list: for a book added by mistake that you
// don't own. Only a copy that's never been lent or borrowed, so no one's
// History loses a loan. Your read mark, heart and note on it go to the
// book itself, as Also read keeps them
export async function moveToWantToRead(
  userId: User["id"],
  bookId: Book["id"],
): Promise<{ ok: true } | { ok: false; reason: "missing" | "lent" }> {
  const book = await prisma.book.findFirst({
    // Only your own copy: a housemate's on your shared shelf is theirs to keep
    where: { id: bookId, userId },
    select: {
      id: true,
      title: true,
      author: true,
      cover: true,
      isbn: true,
      openLibraryKey: true,
      borrowerId: true,
      readAt: true,
      _count: { select: { lendingHistory: true } },
      readerNotes: { where: { userId }, select: { loved: true, body: true, readAt: true } },
    },
  });
  if (!book) return { ok: false, reason: "missing" };
  if (book.borrowerId || book._count.lendingHistory > 0) return { ok: false, reason: "lent" };

  await addWantToRead(userId, {
    title: book.title,
    author: book.author,
    cover: book.cover,
    openLibraryKey: book.openLibraryKey,
    isbn: book.isbn,
  });
  const mine = book.readerNotes[0];
  const read = Boolean(book.readAt ?? mine?.readAt);
  if (book.openLibraryKey?.startsWith("/works/") && (read || mine?.loved || mine?.body)) {
    await saveWorkNote(
      userId,
      { key: book.openLibraryKey, title: book.title, author: book.author, cover: book.cover },
      { loved: mine?.loved ?? false, body: mine?.body ?? null, read },
    );
  }
  await prisma.book.delete({ where: { id: book.id } });
  return { ok: true };
}

// You got hold of a copy: it leaves the list and joins your shelf
export async function moveToShelf(id: string, userId: User["id"]) {
  const wish = await prisma.wantToRead.findFirst({ where: { id, userId } });
  if (!wish) return null;
  const book = await createBook({
    title: wish.title,
    author: wish.author,
    body: "",
    cover: wish.cover,
    openLibraryKey: wish.openLibraryKey,
    isbn: wish.isbn,
    userId,
  });
  await prisma.wantToRead.delete({ where: { id } });
  await notifyWanters(userId, [book]);
  return book;
}

// A friend added a book that's on your list. Tell everyone it applies to,
// once per book.
export async function notifyWanters(
  ownerId: User["id"],
  books: Pick<Book, "id" | "title" | "openLibraryKey" | "isbn">[],
) {
  if (books.length === 0) return;
  const [owner, friendIds] = await Promise.all([
    prisma.user.findUnique({
      where: { id: ownerId },
      select: { firstname: true, surname: true },
    }),
    friendIdsOf(ownerId),
  ]);
  if (!owner || friendIds.length === 0) return;

  const wishes = await prisma.wantToRead.findMany({
    where: { userId: { in: friendIds } },
    select: { userId: true, title: true, openLibraryKey: true, isbn: true },
  });
  for (const wish of wishes) {
    const book = books.find((candidate) => sameWork(wish, candidate));
    if (!book) continue;
    const already = await prisma.notification.findFirst({
      where: { type: "WANT_MATCH", receiverId: wish.userId, bookId: book.id },
      select: { id: true },
    });
    if (already) continue;
    await prisma.notification.create({
      data: {
        type: "WANT_MATCH",
        senderId: ownerId,
        receiverId: wish.userId,
        senderName: `${owner.firstname} ${owner.surname}`,
        bookId: book.id,
        bookTitle: book.title,
      },
    });
  }
}
