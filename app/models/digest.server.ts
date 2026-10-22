import type { User } from "@prisma/client";

import { prisma } from "~/db.server";

import type { FriendActivity } from "./activity.server";
import { getFriendActivity } from "./activity.server";
import { getHomeBooks } from "./book.server";
import { shelfIds } from "./household.server";

// The weekly email: what friends did, what's due back, and anything from
// the want-to-read list that turned up. Nothing is sent when there's
// nothing to say.

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7;

export interface DueItem {
  bookId: string;
  title: string;
  cover: string;
  person: string;
  direction: "borrowed" | "lent";
  // Days until due; negative once it's late
  days: number;
}

export interface Digest {
  activity: FriendActivity[];
  due: DueItem[];
  wanted: { title: string; friend: string; bookId: string | null }[];
}

const daysUntil = (date: Date) => Math.round((date.getTime() - Date.now()) / DAY);

export async function buildDigest(userId: User["id"]): Promise<Digest> {
  const [activity, books, matches] = await Promise.all([
    getFriendActivity(userId, { days: WEEK, limit: 12 }),
    getHomeBooks(userId, await shelfIds(userId)),
    prisma.notification.findMany({
      where: {
        type: "WANT_MATCH",
        receiverId: userId,
        createdAt: { gte: new Date(Date.now() - WEEK * DAY) },
      },
      select: { bookTitle: true, senderName: true, bookId: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const due: DueItem[] = [
    ...books.borrowed.flatMap((book) =>
      book.dueDate
        ? [{ bookId: book.id, title: book.title, cover: book.cover, person: `${book.owner.firstname} ${book.owner.surname}`, direction: "borrowed" as const, days: daysUntil(book.dueDate) }]
        : [],
    ),
    ...books.lent.flatMap((book) =>
      book.dueDate && book.borrower
        ? [{ bookId: book.id, title: book.title, cover: book.cover, person: `${book.borrower.firstname} ${book.borrower.surname}`, direction: "lent" as const, days: daysUntil(book.dueDate) }]
        : [],
    ),
  ]
    .filter((item) => item.days <= WEEK)
    .sort((a, b) => a.days - b.days);

  return {
    activity,
    due,
    wanted: matches.map((match) => ({
      title: match.bookTitle ?? "",
      friend: match.senderName,
      bookId: match.bookId,
    })),
  };
}

export const digestIsEmpty = (digest: Digest) =>
  digest.activity.length === 0 && digest.due.length === 0 && digest.wanted.length === 0;

// Real accounts who want email and have something to hear about: a
// friend, or a book out on loan either way
export async function getDigestRecipients() {
  const users = await prisma.user.findMany({
    where: { demoGroup: null, weeklyDigest: true, emailVerifiedAt: { not: null } },
    select: {
      id: true,
      email: true,
      firstname: true,
      _count: { select: { following: true, borrowedBooks: true } },
      books: { where: { borrowerId: { not: null } }, select: { id: true }, take: 1 },
    },
  });
  return users
    .filter((user) => user._count.following > 0 || user._count.borrowedBooks > 0 || user.books.length > 0)
    .map(({ id, email, firstname }) => ({ id, email, firstname }));
}
