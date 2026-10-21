import type { User, Book } from "@prisma/client";

import { prisma } from "~/db.server";
import { cleanSubjects } from "~/utils";

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
    select: {
      id: true,
      body: true,
      author: true,
      title: true,
      cover: true,
      datePublished: true,
      pageCount: true,
      subjects: true,
      publisher: true,
      openLibraryKey: true,
      firstSentence: true,
      authorKey: true,
      detailsFetchedAt: true,
      userId: true,
      borrowerId: true,
      borrowedAt: true,
      dueDate: true,
      borrower: {
        select: {
          id: true,
          firstname: true,
          surname: true,
        },
      },
      user: {
        select: {
          id: true,
          firstname: true,
          surname: true,
          shareToken: true,
        },
      },
    },
    where: { id },
  });
}

export function getBookListItems(userId: User["id"]) {
  return prisma.book.findMany({
    where: {
      userId: userId,
    },
    select: {
      id: true,
      title: true,
      cover: true,
      author: true,
      datePublished: true,
      pageCount: true,
      lendCount: true,
      userId: true,
      borrowerId: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

export function getPublicBookListItems(userId: User["id"]) {
  return prisma.book.findMany({
    where: {
      userId: userId,
    },
    select: { id: true, title: true, cover: true, author: true },
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

type BookInput = Pick<Book, "title" | "author" | "body" | "cover"> & {
  datePublished?: string | null;
  pageCount?: number | null;
  subjects?: string | null;
  publisher?: string | null;
  openLibraryKey?: string | null;
};

export function createBook({
  title,
  author,
  body,
  cover,
  datePublished,
  pageCount,
  subjects,
  publisher,
  openLibraryKey,
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
      datePublished,
      pageCount,
      // Open Library's subject list mixes real topics with catalog codes
      subjects: cleanSubjects(subjects).join(", ") || null,
      publisher,
      openLibraryKey,
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

// Loan lengths the owner can pick from, in weeks
export const LOAN_WEEKS = [1, 2, 3, 4, 6, 8] as const;
export const DEFAULT_LOAN_WEEKS = 4;
export const EXTEND_WEEKS = [1, 2, 4] as const;

const DAY = 24 * 60 * 60 * 1000;

// Keeps a loan length to one of the offered choices
export function loanWeeks(value: unknown, choices: readonly number[] = LOAN_WEEKS) {
  const weeks = Number(value);
  return choices.includes(weeks) ? weeks : DEFAULT_LOAN_WEEKS;
}

// Reminders that no longer apply once a loan is extended or ends
function clearDueReminders(bookId: Book["id"], borrowerId: User["id"]) {
  return prisma.notification.updateMany({
    where: {
      bookId,
      receiverId: borrowerId,
      read: false,
      type: { in: ["DUE_SOON_REMINDER", "OVERDUE_REMINDER"] },
    },
    data: { read: true, actionTaken: "dismissed" },
  });
}

export async function lendBook(
  bookId: Book["id"],
  borrowerId: User["id"],
  weeks: number = DEFAULT_LOAN_WEEKS,
) {
  const borrowedAt = new Date();
  const dueDate = new Date(borrowedAt.getTime() + weeks * 7 * DAY);

  // Create lending history record
  await prisma.lendingHistory.create({
    data: {
      bookId,
      borrowerId,
      borrowedAt,
    },
  });

  return prisma.book.update({
    where: { id: bookId },
    data: {
      borrowerId,
      borrowedAt,
      dueDate,
      lendCount: { increment: 1 },
    },
  });
}

// Pushes the due date back; an overdue loan is extended from today
export async function extendLoan(bookId: Book["id"], weeks: number) {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { borrowerId: true, dueDate: true },
  });
  if (!book?.borrowerId) return null;

  const from = Math.max(book.dueDate?.getTime() ?? 0, Date.now());
  const dueDate = new Date(from + weeks * 7 * DAY);
  await clearDueReminders(bookId, book.borrowerId);
  return prisma.book.update({ where: { id: bookId }, data: { dueDate } });
}

export async function returnBook(bookId: Book["id"]) {
  const current = await prisma.book.findUnique({
    where: { id: bookId },
    select: { borrowerId: true },
  });
  if (current?.borrowerId) await clearDueReminders(bookId, current.borrowerId);

  // Update the most recent lending history record with return date
  const latestLending = await prisma.lendingHistory.findFirst({
    where: { bookId, returnedAt: null },
    orderBy: { borrowedAt: "desc" },
  });

  if (latestLending) {
    await prisma.lendingHistory.update({
      where: { id: latestLending.id },
      data: { returnedAt: new Date() },
    });
  }

  return prisma.book.update({
    where: { id: bookId },
    data: { borrowerId: null, borrowedAt: null, dueDate: null },
  });
}

export function updateBookMetadata(
  bookId: Book["id"],
  data: {
    title?: string;
    author?: string;
    cover?: string;
    datePublished?: string | null;
    pageCount?: number | null;
    subjects?: string | null;
    publisher?: string | null;
    openLibraryKey?: string | null;
    body?: string;
  },
) {
  return prisma.book.update({
    where: { id: bookId },
    data,
  });
}

export function getBorrowedBooks(userId: User["id"]) {
  return prisma.book.findMany({
    where: { borrowerId: userId },
    select: {
      id: true,
      title: true,
      cover: true,
      author: true,
      datePublished: true,
      pageCount: true,
      lendCount: true,
      userId: true,
      borrowerId: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getBookStats(userId: User["id"]) {
  const [totalBooks, borrowedBooks, lentBooks] = await Promise.all([
    prisma.book.count({ where: { userId } }),
    prisma.book.count({ where: { borrowerId: userId } }),
    prisma.book.count({ where: { userId, borrowerId: { not: null } } }),
  ]);

  return { totalBooks, borrowedBooks, lentBooks };
}

export async function getUserLibraryKeys(userId: User["id"]) {
  const books = await prisma.book.findMany({
    where: { userId },
    select: { openLibraryKey: true },
  });
  return books.map((b) => b.openLibraryKey).filter(Boolean) as string[];
}

export async function bookExistsInLibrary(
  userId: User["id"],
  openLibraryKey: string,
) {
  const book = await prisma.book.findFirst({
    where: { userId, openLibraryKey },
    select: { id: true },
  });
  return book !== null;
}

export async function getOverdueBooks() {
  const now = new Date();
  return prisma.book.findMany({
    where: {
      borrowerId: { not: null },
      dueDate: { lt: now },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      borrowerId: true,
      userId: true,
      user: {
        select: {
          id: true,
          firstname: true,
          surname: true,
        },
      },
      borrower: {
        select: {
          id: true,
          firstname: true,
          surname: true,
        },
      },
    },
  });
}

export async function getBooksNearDue(daysUntilDue = 3) {
  const now = new Date();
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() + daysUntilDue);

  return prisma.book.findMany({
    where: {
      borrowerId: { not: null },
      dueDate: {
        gt: now,
        lte: threshold,
      },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      borrowerId: true,
      userId: true,
      user: {
        select: {
          id: true,
          firstname: true,
          surname: true,
        },
      },
      borrower: {
        select: {
          id: true,
          firstname: true,
          surname: true,
        },
      },
    },
  });
}

export async function getLendingHistory(bookId: Book["id"]) {
  return prisma.lendingHistory.findMany({
    where: { bookId },
    orderBy: { borrowedAt: "desc" },
    select: {
      id: true,
      borrowedAt: true,
      returnedAt: true,
      borrower: {
        select: {
          id: true,
          firstname: true,
          surname: true,
          shareToken: true,
          profileEmoji: true,
        },
      },
    },
  });
}

// Books on friends' shelves whose title or author matches the query
export async function searchFriendsBooks(userId: User["id"], query: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { following: { select: { id: true } } },
  });
  const friendIds = user?.following.map((friend) => friend.id) ?? [];
  const term = query.trim();
  if (friendIds.length === 0 || !term) return [];

  return prisma.book.findMany({
    where: {
      userId: { in: friendIds },
      OR: [{ title: { contains: term } }, { author: { contains: term } }],
    },
    select: {
      id: true,
      title: true,
      author: true,
      cover: true,
      borrowerId: true,
      user: { select: { id: true, firstname: true, surname: true } },
    },
    orderBy: { title: "asc" },
    take: 30,
  });
}
