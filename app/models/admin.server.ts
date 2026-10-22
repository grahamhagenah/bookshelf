import type { Prisma, User } from "@prisma/client";

import { prisma } from "~/db.server";

// Everything the admin dashboard shows. Demo sandboxes are left out of
// every number: only real accounts (demoGroup null) count.

const DAY = 24 * 60 * 60 * 1000;
const real = { demoGroup: null } as const;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY);

// "2026-10-21" for a date, in UTC, to bucket things by day
const dayKey = (date: Date) => date.toISOString().slice(0, 10);

// One count per day for the last `days` days, oldest first
function perDay(dates: Date[], days: number) {
  const counts = new Map<string, number>();
  for (const date of dates) {
    const key = dayKey(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from({ length: days }, (_, index) => {
    const key = dayKey(daysAgo(days - 1 - index));
    return { day: key, count: counts.get(key) ?? 0 };
  });
}

// Headline numbers and 30-day series for sign-ups and loans
export async function getHealth() {
  const now = new Date();
  const [
    users,
    newUsers7,
    newUsers30,
    books,
    booksAdded7,
    onLoan,
    overdue,
    loansStarted30,
    demoGroups,
    signupDates,
    loanDates,
    friendLinks,
  ] = await Promise.all([
    prisma.user.count({ where: real }),
    prisma.user.count({ where: { ...real, createdAt: { gte: daysAgo(7) } } }),
    prisma.user.count({ where: { ...real, createdAt: { gte: daysAgo(30) } } }),
    prisma.book.count({ where: { user: real } }),
    prisma.book.count({ where: { user: real, createdAt: { gte: daysAgo(7) } } }),
    prisma.book.count({ where: { user: real, borrowerId: { not: null } } }),
    prisma.book.count({
      where: { user: real, borrowerId: { not: null }, dueDate: { lt: now } },
    }),
    prisma.lendingHistory.count({
      where: { book: { user: real }, borrowedAt: { gte: daysAgo(30) } },
    }),
    // A sandbox per demo visit; its users share a demoGroup
    prisma.user.findMany({
      where: { demoGroup: { not: null }, createdAt: { gte: daysAgo(1) } },
      select: { demoGroup: true },
      distinct: ["demoGroup"],
    }),
    prisma.user.findMany({
      where: { ...real, createdAt: { gte: daysAgo(30) } },
      select: { createdAt: true },
    }),
    prisma.lendingHistory.findMany({
      where: { book: { user: real }, borrowedAt: { gte: daysAgo(30) } },
      select: { borrowedAt: true },
    }),
    prisma.user.findMany({
      where: real,
      select: { _count: { select: { following: true } } },
    }),
  ]);

  return {
    users,
    newUsers7,
    newUsers30,
    books,
    booksAdded7,
    onLoan,
    overdue,
    loansStarted30,
    demosToday: demoGroups.length,
    // Friendships go both ways, so each is counted twice
    friendships: Math.floor(
      friendLinks.reduce((sum, user) => sum + user._count.following, 0) / 2,
    ),
    signupsPerDay: perDay(
      signupDates.map((user) => user.createdAt),
      30,
    ),
    loansPerDay: perDay(
      loanDates.map((loan) => loan.borrowedAt),
      30,
    ),
  };
}

const person = { select: { id: true, firstname: true, surname: true } } as const;

// Loans that are past due, most overdue first; plus the books and people
// doing the most lending
export async function getLending() {
  const [overdue, mostLent, loans] = await Promise.all([
    prisma.book.findMany({
      where: { user: real, borrowerId: { not: null }, dueDate: { lt: new Date() } },
      select: { id: true, title: true, dueDate: true, user: person, borrower: person },
      orderBy: { dueDate: "asc" },
      take: 20,
    }),
    prisma.book.findMany({
      where: { user: real, lendCount: { gt: 0 } },
      select: { id: true, title: true, lendCount: true, user: person },
      orderBy: { lendCount: "desc" },
      take: 5,
    }),
    prisma.lendingHistory.findMany({
      where: { book: { user: real } },
      select: { book: { select: { user: person } } },
    }),
  ]);

  const byLender = new Map<string, { name: string; loans: number }>();
  for (const { book } of loans) {
    const { id, firstname, surname } = book.user;
    const entry = byLender.get(id) ?? { name: `${firstname} ${surname}`, loans: 0 };
    entry.loans += 1;
    byLender.set(id, entry);
  }
  const topLenders = [...byLender.entries()]
    .map(([id, entry]) => ({ id, ...entry }))
    .sort((a, b) => b.loans - a.loans)
    .slice(0, 5);

  return { overdue, mostLent, topLenders };
}

// Every real account with what they've been doing, newest first
export async function getAdminUsers() {
  const users = await prisma.user.findMany({
    where: real,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      firstname: true,
      surname: true,
      isAdmin: true,
      createdAt: true,
      books: {
        select: { title: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      },
      following: { select: { firstname: true, surname: true } },
      lendingHistory: {
        select: { borrowedAt: true },
        orderBy: { borrowedAt: "desc" },
        take: 1,
      },
      readerNotes: {
        select: { updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
      _count: { select: { lendingHistory: true } },
    },
  });

  return users.map((user) => {
    // Last sign of life: joining, adding a book, borrowing, or a note
    const lastActive = [
      user.createdAt,
      user.books[0]?.createdAt,
      user.lendingHistory[0]?.borrowedAt,
      user.readerNotes[0]?.updatedAt,
    ]
      .filter((date): date is Date => Boolean(date))
      .reduce((latest, date) => (date > latest ? date : latest));
    return {
      id: user.id,
      email: user.email,
      name: `${user.firstname} ${user.surname}`,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      lastActive,
      bookCount: user.books.length,
      friendCount: user.following.length,
      borrowedCount: user._count.lendingHistory,
      bookTitles: user.books.slice(0, 12).map((book) => book.title),
      friendNames: user.following.map((friend) => `${friend.firstname} ${friend.surname}`),
    };
  });
}

// Books that could use better details, and demo sandboxes to clear out
const missing = {
  cover: { cover: "" },
  description: { body: "" },
  subjects: { OR: [{ subjects: null }, { subjects: "" }] },
} satisfies Record<string, Prisma.BookWhereInput>;

export async function getDataQuality() {
  const [books, noCover, noDescription, noSubjects, sandboxes] =
    await Promise.all([
      prisma.book.findMany({
        where: { user: real, OR: Object.values(missing) },
        select: {
          id: true,
          title: true,
          cover: true,
          body: true,
          subjects: true,
          user: { select: { firstname: true, surname: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      prisma.book.count({ where: { user: real, ...missing.cover } }),
      prisma.book.count({ where: { user: real, ...missing.description } }),
      prisma.book.count({ where: { user: real, ...missing.subjects } }),
      prisma.user.findMany({
        where: { demoGroup: { not: null } },
        select: { demoGroup: true, createdAt: true },
        distinct: ["demoGroup"],
      }),
    ]);

  return {
    books: books.map((book) => ({
      id: book.id,
      title: book.title,
      owner: `${book.user.firstname} ${book.user.surname}`,
      missing: [
        !book.cover && "cover",
        !book.body && "description",
        !book.subjects && "subjects",
      ].filter((field): field is string => Boolean(field)),
    })),
    noCover,
    noDescription,
    noSubjects,
    sandboxes: sandboxes.length,
    expiredSandboxes: sandboxes.filter((sandbox) => sandbox.createdAt < daysAgo(1))
      .length,
  };
}

export function setAdmin(userId: User["id"], isAdmin: boolean) {
  return prisma.user.update({ where: { id: userId }, data: { isAdmin } });
}
