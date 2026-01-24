import type { User, Book } from "@prisma/client";

import { prisma } from "~/db.server";

export function getBook({
  id,
  userId,

}: Pick<Book, "id"> & {
  userId: User["id"];
}) {
  return prisma.book.findFirst({
    select: { id: true, body: true, author: true, title: true, cover: true },
    where: { id, userId },
  });
}

export function getBookById(id: Book["id"]) {
  return prisma.book.findUnique({
    select: { id: true, body: true, author: true, title: true, cover: true, userId: true, borrowerId: true },
    where: { id },
  });
}

export function getBookListItems(userId: User["id"]) {
  return prisma.book.findMany({
    where: {
      userId: userId,
    },
    select: { id: true, title: true, cover: true, userId: true, borrowerId: true },
    orderBy: { updatedAt: "desc" },
  });
}

// export function getBooksByUserId(userId) {
//   try {
//     const books = await prisma.book.findMany({
//       where: {
//         userId: userId, // Replace with the actual variable holding the userId you want to search for
//       },
//     });
//     return books;
//   } catch (error) {
//     throw error;
//   } finally {
//     await prisma.$disconnect();
//   }
// }

type BookInput = Pick<Book, "title" | "author" | "body" | "cover">;

export function createBook({
  title,
  author,
  body,
  cover,
  userId,
}: BookInput & {
  userId: User["id"];
}) {
  return prisma.book.create({
    data: {
      title,
      author,
      body,
      cover,
      user: {
        connect: {
          id: userId,
        },
      },
    },
  });
}

export function deleteBook({
  id,
  userId,
}: Pick<Book, "id"> & { userId: User["id"] }) {
  return prisma.book.deleteMany({
    where: { id, userId },
  });
}

export function lendBook(bookId: Book["id"], borrowerId: User["id"]) {
  return prisma.book.update({
    where: { id: bookId },
    data: { borrowerId },
  });
}

export function returnBook(bookId: Book["id"]) {
  return prisma.book.update({
    where: { id: bookId },
    data: { borrowerId: null },
  });
}

export function getBorrowedBooks(userId: User["id"]) {
  return prisma.book.findMany({
    where: { borrowerId: userId },
    select: { id: true, title: true, cover: true, userId: true, borrowerId: true },
    orderBy: { updatedAt: "desc" },
  });
}
