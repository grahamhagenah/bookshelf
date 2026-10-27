import { prisma } from "~/db.server";
import type { User, Book } from "~/generated/prisma/client";
import { cleanSubjects, hasTranslationSubjects } from "~/utils";
import type { Work } from "~/works";
import { sameWork } from "~/works";

import { shelfIds, shelfIdsFor } from "./household.server";
import { adoptWorkNotes } from "./work-note.server";

// Stops lending a book until a moment (far off means until they say),
// or, given null, starts again
export function setNotLending(bookId: Book["id"], until: Date | null) {
  return prisma.book.update({
    where: { id: bookId },
    data: { notLendingUntil: until },
  });
}

export function getBookById(id: Book["id"]) {
  return prisma.book.findUnique({
    select: {
      id: true,
      notLendingUntil: true,
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
      hiddenFromPage: true,
      userId: true,
      borrowerId: true,
      borrowedAt: true,
      dueDate: true,
      createdAt: true,
      lendCount: true,
      readAt: true,
      borrower: {
        select: {
          id: true,
          firstname: true,
          surname: true,
          profileEmoji: true,
          invitedAt: true,
          nameOnly: true,
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

// Everything on a shelf. ownerIds is one person, or a whole household.
export function getBookListItems(ownerIds: User["id"][]) {
  return prisma.book.findMany({
    where: {
      userId: { in: ownerIds },
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
      notLendingUntil: true,
      readAt: true,
      // The viewer's own read mark is picked out by the caller
      readerNotes: { select: { userId: true, readAt: true } },
    },
    // Newest added first. Not by last change: opening a book, or a friend
    // asking for it, touches the row, and the shelf shouldn't reshuffle
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

// Everything on the home page: books you've borrowed, books you've lent
// out (soonest due first), the rest of your shelf, and your newest books
export async function getHomeBooks(
  userId: User["id"],
  ownerIds: User["id"][] = [userId],
) {
  const person = { select: { id: true, firstname: true, surname: true } };
  const fields = {
    id: true,
    title: true,
    author: true,
    cover: true,
    borrowedAt: true,
    dueDate: true,
  } as const;

  const [own, borrowed] = await Promise.all([
    prisma.book.findMany({
      where: { userId: { in: ownerIds } },
      select: { ...fields, borrower: person },
      orderBy: { createdAt: "desc" },
    }),
    prisma.book.findMany({
      where: { borrowerId: userId },
      select: {
        ...fields,
        user: person,
        // Whoever's next in line for it, so it can be handed on
        holds: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          take: 1,
          select: { user: { select: { firstname: true } } },
        },
      },
      orderBy: { dueDate: "asc" },
    }),
  ]);

  const due = (book: { dueDate: Date | null }) =>
    book.dueDate?.getTime() ?? Infinity;
  return {
    borrowed: borrowed.map(({ user, holds, ...book }) => ({
      ...book,
      owner: user,
      nextInLine: holds[0]?.user.firstname ?? null,
    })),
    lent: own.filter((book) => book.borrower).sort((a, b) => due(a) - due(b)),
    shelf: own.filter((book) => !book.borrower),
    // Two rows of covers on the home page
    recent: own.slice(0, 12),
  };
}

// A shelf as its public page shows it: everything but what's kept off it
export function getPublicBookListItems(ownerIds: User["id"][]) {
  return prisma.book.findMany({
    where: {
      userId: { in: ownerIds },
      hiddenFromPage: false,
    },
    select: { id: true, title: true, cover: true, author: true },
    // In the order they were added, like the shelf itself
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

export type BookInput = Pick<Book, "title" | "author" | "body" | "cover"> & {
  datePublished?: string | null;
  pageCount?: number | null;
  subjects?: string | null;
  publisher?: string | null;
  openLibraryKey?: string | null;
  isbn?: string | null;
};

export async function createBook({
  title,
  author,
  body,
  cover,
  datePublished,
  pageCount,
  subjects,
  publisher,
  openLibraryKey,
  isbn,
  userId,
}: BookInput & {
  userId: User["id"];
}) {
  const book = await prisma.book.create({
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
      isbn,
      user: {
        connect: {
          id: userId,
        },
      },
    },
  });
  // Noted before it was yours? Those marks come along onto it
  if (openLibraryKey) await adoptWorkNotes(book.id);
  return book;
}

// Whether this person has read this copy: kept on their reader note, so
// two people sharing a shelf each have their own
export async function setRead(
  bookId: Book["id"],
  userId: User["id"],
  read: boolean,
) {
  const readAt = read ? new Date() : null;
  // Unmarking clears the copy's old read date too, if it's yours, so it
  // can't show through
  if (!read) {
    await prisma.book.updateMany({
      where: { id: bookId, userId },
      data: { readAt: null },
    });
  }
  return prisma.readerNote.upsert({
    where: { bookId_userId: { bookId, userId } },
    create: { bookId, userId, readAt },
    update: { readAt },
  });
}

// One person's read mark on one copy
export async function getReadAt(
  userId: User["id"],
  book: { id: string; userId: string; readAt: Date | null },
) {
  const note = await prisma.readerNote.findUnique({
    where: { bookId_userId: { bookId: book.id, userId } },
    select: { readAt: true },
  });
  return readAtFor(userId, {
    ...book,
    readerNotes: note ? [{ userId, ...note }] : [],
  });
}

// Their own mark, falling back to the copy's old one for whoever added it
export function readAtFor(
  userId: User["id"],
  book: {
    userId: string;
    readAt: Date | null;
    readerNotes: { userId: string; readAt: Date | null }[];
  },
) {
  // A note row can exist just for a heart, with no read date of its own
  const mine = book.readerNotes.find((note) => note.userId === userId);
  if (mine?.readAt) return mine.readAt;
  return book.userId === userId ? book.readAt : null;
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
export function loanWeeks(
  value: unknown,
  choices: readonly number[] = LOAN_WEEKS,
) {
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

  // Whoever gets the book no longer needs to wait for it
  await prisma.hold.deleteMany({ where: { bookId, userId: borrowerId } });

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
// Hand a book straight to a friend, without waiting for them to ask. Any
// request they'd already sent for it counts as answered.
export async function lendToFriend(
  bookId: Book["id"],
  ownerId: User["id"],
  friendId: User["id"],
  weeks: number,
) {
  const lent = await lendBook(bookId, friendId, weeks);
  await prisma.notification.updateMany({
    where: {
      type: "BOOK_REQUEST",
      bookId,
      senderId: friendId,
      receiverId: ownerId,
      actionTaken: null,
    },
    data: { read: true, actionTaken: "approved" },
  });
  return lent;
}

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
    select: { borrowerId: true, dueDate: true },
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
      data: { returnedAt: new Date(), dueDate: current?.dueDate ?? null },
    });
  }

  return prisma.book.update({
    where: { id: bookId },
    data: { borrowerId: null, borrowedAt: null, dueDate: null },
  });
}

// How long an owner has to say a returned book never actually came back
export const UNDO_RETURN_DAYS = 14;

// The latest return of a book, if the owner can still take it back: it's
// recent, and nobody has borrowed the book since
export async function undoableReturn(bookId: Book["id"], now = new Date()) {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { borrowerId: true },
  });
  if (!book || book.borrowerId) return null;
  const last = await prisma.lendingHistory.findFirst({
    where: { bookId },
    orderBy: { borrowedAt: "desc" },
  });
  if (!last?.returnedAt) return null;
  if (now.getTime() - last.returnedAt.getTime() > UNDO_RETURN_DAYS * DAY) {
    return null;
  }
  return last;
}

// The owner says a book marked returned never came back: the loan picks up
// where it left off, due when it was due, and the borrower hears so. If the
// book went to whoever was first in line, and they haven't been answered
// yet, they're back at the front of the line.
export async function undoReturn(
  bookId: Book["id"],
  owner: { id: User["id"]; name: string },
) {
  const last = await undoableReturn(bookId);
  if (!last?.returnedAt) return null;
  const since = last.returnedAt;

  const handedOn = await prisma.notification.findMany({
    where: { type: "HOLD_READY", bookId, createdAt: { gte: since } },
    select: { id: true, receiverId: true },
  });
  for (const notice of handedOn) {
    const request = await prisma.notification.findFirst({
      where: {
        type: "BOOK_REQUEST",
        bookId,
        senderId: notice.receiverId,
        actionTaken: null,
        createdAt: { gte: since },
      },
      select: { id: true },
    });
    if (!request) continue;
    const first = await prisma.hold.findFirst({
      where: { bookId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });
    await prisma.$transaction([
      prisma.notification.deleteMany({
        where: { id: { in: [request.id, notice.id] } },
      }),
      prisma.hold.upsert({
        where: { bookId_userId: { bookId, userId: notice.receiverId } },
        create: {
          bookId,
          userId: notice.receiverId,
          createdAt: new Date((first?.createdAt ?? new Date()).getTime() - 1000),
        },
        update: {},
      }),
    ]);
  }

  const book = await prisma.book.update({
    where: { id: bookId },
    data: {
      borrowerId: last.borrowerId,
      borrowedAt: last.borrowedAt,
      // Returned before due dates were kept: a usual loan from when it went
      dueDate:
        last.dueDate ??
        new Date(last.borrowedAt.getTime() + DEFAULT_LOAN_WEEKS * 7 * DAY),
    },
    select: { id: true, title: true },
  });
  await prisma.lendingHistory.update({
    where: { id: last.id },
    data: { returnedAt: null, dueDate: null },
  });
  // The "returned" notice has had its answer. It's sent a moment before
  // the return is recorded, so anything since the loan began
  await prisma.notification.updateMany({
    where: {
      type: "BOOK_RETURNED",
      bookId,
      createdAt: { gte: last.borrowedAt },
    },
    data: { read: true, actionTaken: "undone" },
  });
  if (last.borrowerId !== owner.id) {
    await prisma.notification.create({
      data: {
        type: "RETURN_UNDONE",
        senderId: owner.id,
        receiverId: last.borrowerId,
        senderName: owner.name,
        bookId: book.id,
        bookTitle: book.title,
      },
    });
  }
  return { borrowerId: last.borrowerId };
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
    // Most recently borrowed first
    orderBy: [{ borrowedAt: "desc" }, { id: "desc" }],
  });
}

export async function getBookStats(
  userId: User["id"],
  ownerIds: User["id"][] = [userId],
) {
  const [totalBooks, borrowedBooks, lentBooks] = await Promise.all([
    prisma.book.count({ where: { userId: { in: ownerIds } } }),
    prisma.book.count({ where: { borrowerId: userId } }),
    prisma.book.count({
      where: { userId: { in: ownerIds }, borrowerId: { not: null } },
    }),
  ]);

  return { totalBooks, borrowedBooks, lentBooks };
}

export async function getUserLibraryKeys(ownerIds: User["id"][]) {
  const books = await prisma.book.findMany({
    where: { userId: { in: ownerIds } },
    select: { openLibraryKey: true },
  });
  return books.map((b) => b.openLibraryKey).filter(Boolean) as string[];
}

// Your shelf's copy of a book, by work key or, for books that came in
// without one (imports, scans), by title. Null when you don't have it.
export async function findOwnCopy(ownerIds: User["id"][], work: Work) {
  const books = await prisma.book.findMany({
    where: { userId: { in: ownerIds } },
    select: { id: true, title: true, openLibraryKey: true, isbn: true },
  });
  return books.find((book) => sameWork(book, work)) ?? null;
}

export async function bookExistsInLibrary(
  ownerIds: User["id"][],
  openLibraryKey: string,
) {
  const book = await prisma.book.findFirst({
    where: { userId: { in: ownerIds }, openLibraryKey },
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
      borrowedAt: true,
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
          // Lent by name only: their reminders go to the owner
          nameOnly: true,
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
      borrowedAt: true,
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
          // Lent by name only: their reminders go to the owner
          nameOnly: true,
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
  // A friend's household shares their shelf
  const shelfOwners = await shelfIdsFor(friendIds);

  return prisma.book.findMany({
    where: {
      userId: { in: shelfOwners },
      OR: [{ title: { contains: term } }, { author: { contains: term } }],
    },
    select: {
      id: true,
      title: true,
      author: true,
      cover: true,
      borrowerId: true,
      notLendingUntil: true,
      user: { select: { id: true, firstname: true, surname: true } },
    },
    orderBy: { title: "asc" },
    take: 30,
  });
}

// A whole shelf for the CSV download, each copy with the viewer's own
// read date, heart and note
export async function getExportBooks(
  userId: User["id"],
  ownerIds: User["id"][],
) {
  const books = await prisma.book.findMany({
    where: { userId: { in: ownerIds } },
    select: {
      title: true,
      author: true,
      isbn: true,
      publisher: true,
      pageCount: true,
      datePublished: true,
      createdAt: true,
      userId: true,
      readAt: true,
      readerNotes: {
        where: { userId },
        select: { userId: true, readAt: true, loved: true, body: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return books.map((book) => ({
    ...book,
    readAt: readAtFor(userId, book),
    loved: book.readerNotes[0]?.loved ?? false,
    note: book.readerNotes[0]?.body ?? null,
  }));
}

// Books added before translations' subjects were filtered out still store
// them ("Translations into Korean"). Tidy one when it's opened; returns the
// cleaned list (which may be null), or undefined when there was nothing to do.
export async function tidySubjects(book: Pick<Book, "id" | "subjects">) {
  if (!book.subjects || !hasTranslationSubjects(book.subjects))
    return undefined;
  const subjects = cleanSubjects(book.subjects).join(", ") || null;
  await prisma.book.update({ where: { id: book.id }, data: { subjects } });
  return subjects;
}

// Whether there's anything on their shelf (theirs or a housemate's)
export async function hasBooks(userId: User["id"]) {
  const book = await prisma.book.findFirst({
    where: { userId: { in: await shelfIds(userId) } },
    select: { id: true },
  });
  return book !== null;
}
