import type { Prisma } from "@prisma/client";

import { prisma } from "~/db.server";
import { sendNewSignupEmail } from "~/email.server";

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
      plan: true,
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
      firstname: user.firstname,
      surname: user.surname,
      name: `${user.firstname} ${user.surname}`,
      isAdmin: user.isAdmin,
      plus: user.plan === "plus",
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

// How far people get after signing up: a book on their shelf, a real
// shelf's worth, a friend, then a book changing hands. Each step counts
// everyone who's done it, out of the people who signed up in the window.
export async function getFunnel() {
  const people = await prisma.user.findMany({
    where: real,
    select: {
      createdAt: true,
      _count: { select: { books: true, following: true, lendingHistory: true } },
      // Any of their books ever lent out
      books: { where: { lendCount: { gt: 0 } }, select: { id: true }, take: 1 },
      // Kept after canceling, so this is anyone who ever paid
      stripeSubscriptionId: true,
    },
  });
  const steps = (since: Date | null) => {
    const cohort = since ? people.filter((person) => person.createdAt >= since) : people;
    const count = (test: (person: (typeof people)[number]) => boolean) =>
      cohort.filter(test).length;
    return [
      { label: "Signed up", count: cohort.length },
      { label: "Added a book", count: count((p) => p._count.books > 0) },
      { label: "Added 10 or more", count: count((p) => p._count.books >= 10) },
      { label: "Made a friend", count: count((p) => p._count.following > 0) },
      {
        label: "Lent or borrowed",
        count: count((p) => p._count.lendingHistory > 0 || p.books.length > 0),
      },
      { label: "Subscribed to Plus", count: count((p) => p.stripeSubscriptionId !== null) },
    ];
  };
  return { allTime: steps(null), last30: steps(daysAgo(30)) };
}

// Plus as a gift, for friends and early users
export function setPlan(userId: string, plus: boolean) {
  return prisma.user.update({ where: { id: userId }, data: { plan: plus ? "plus" : "free" } });
}

// Stacks Plus at a glance: who pays, what that comes to a month, and who's
// on their way out. Gifts count as Plus but not as revenue; amounts are
// before Stripe's fees and any tax.
export async function getRevenue() {
  const [subscribers, ended] = await Promise.all([
    prisma.user.findMany({
      where: { ...real, plan: "plus" },
      select: {
        id: true,
        firstname: true,
        surname: true,
        email: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        planInterval: true,
        planAmount: true,
        planStartedAt: true,
        planRenewsAt: true,
        planEndsAt: true,
      },
      orderBy: [{ planStartedAt: "desc" }, { createdAt: "desc" }],
    }),
    // Paid once, not any more
    prisma.user.count({ where: { ...real, plan: "free", stripeSubscriptionId: { not: null } } }),
  ]);
  const paying = subscribers.filter((user) => user.stripeSubscriptionId);
  const perMonth = (user: (typeof paying)[number]) =>
    (user.planAmount ?? 0) / (user.planInterval === "year" ? 12 : 1);
  return {
    paying: paying.length,
    monthly: paying.filter((user) => user.planInterval === "month").length,
    yearly: paying.filter((user) => user.planInterval === "year").length,
    gifted: subscribers.length - paying.length,
    // Monthly recurring revenue, in cents
    mrr: Math.round(paying.reduce((sum, user) => sum + perMonth(user), 0)),
    canceling: paying.filter((user) => user.planEndsAt).length,
    pastDue: paying.filter((user) => user.subscriptionStatus === "past_due").length,
    ended,
    subscribers: subscribers.map((user) => ({
      id: user.id,
      name: `${user.firstname} ${user.surname}`,
      email: user.email,
      gift: !user.stripeSubscriptionId,
      interval: user.planInterval,
      amount: user.planAmount,
      startedAt: user.planStartedAt,
      renewsAt: user.planRenewsAt,
      endsAt: user.planEndsAt,
      pastDue: user.subscriptionStatus === "past_due",
    })),
  };
}

// Lets the admins know someone new joined: one email each, with the new
// total. Demo accounts never get here, and demo admins aren't written to.
export async function notifyAdminsOfSignup(
  newUser: { id: string; firstname: string; surname: string; email: string },
  { invitedBy = null, send = sendNewSignupEmail }: {
    invitedBy?: string | null;
    send?: (message: Parameters<typeof sendNewSignupEmail>[0]) => Promise<unknown>;
  } = {},
) {
  const [admins, total] = await Promise.all([
    prisma.user.findMany({
      where: { isAdmin: true, ...real, id: { not: newUser.id } },
      select: { email: true },
    }),
    prisma.user.count({ where: real }),
  ]);
  const name = `${newUser.firstname} ${newUser.surname}`;
  // One admin's failed email shouldn't stop the others
  await Promise.all(
    admins.map((admin) =>
      send({ toEmail: admin.email, name, email: newUser.email, invitedBy, total }).catch(() => null),
    ),
  );
  return admins.length;
}
