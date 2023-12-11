import type { User, Book } from "@prisma/client";

import { prisma } from "~/db.server";

export function getBook({
  id,
  userId,

}: Pick<Book, "id"> & {
  userId: User["id"];
}) {
  return prisma.book.findFirst({
    select: { id: true, body: true, title: true, cover: true },
    where: { id, userId },
  });
}

export function getBookListItems({ userId }: { userId: User["id"] }) {
  return prisma.book.findMany({
    where: { userId },
    select: { id: true, title: true, cover: true },
    orderBy: { updatedAt: "desc" },
  });
}

export function getBookCovers({ userId }: { userId: User["id"] }) {
  return prisma.book.findMany({
    where: { userId },
    select: { id: true, cover: true },
    orderBy: { updatedAt: "desc" },
  });
}

export function createBook({
  body,
  title,
  cover,
  userId,
}: Pick<Book, "body" | "title" | "cover"> & {
  userId: User["id"];
}) {
  return prisma.book.create({
    data: {
      title,
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
