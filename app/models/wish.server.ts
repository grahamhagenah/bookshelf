import type { Book, User } from "@prisma/client";

import { prisma } from "~/db.server";
import type { Work } from "~/works";
import { sameWork } from "~/works";

import { createBook } from "./book.server";
import { shelfIdsFor } from "./household.server";

export { normalizeTitle, sameWork } from "~/works";

// Your want-to-read list: books you don't own but would like to. Stacks
// watches your friends' shelves for them.

const person = { select: { id: true, firstname: true, surname: true } } as const;

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
        available: book.borrowerId === null,
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

export function countWantToRead(userId: User["id"]) {
  return prisma.wantToRead.count({ where: { userId } });
}

export function removeWantToRead(id: string, userId: User["id"]) {
  return prisma.wantToRead.deleteMany({ where: { id, userId } });
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
