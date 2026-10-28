import { prisma } from "~/db.server";
import type { User } from "~/generated/prisma/client";
import { isNotLending } from "~/lending";
import { sameWork } from "~/works";

import { shelfIds, shelfIdsFor } from "./household.server";

// The books passed around most among your friends: their copies' loans,
// counted per book (two friends' copies of Dune count together), for
// finding something new to borrow. Only books new to you: none already on
// your shelf or that you've borrowed. Friend groups are small, so one loan
// is enough to be shown; the most lent come first, ties to the one lent
// most recently.

const MIN_LOANS = 1;

export async function getPopularWithFriends(userId: User["id"], limit = 5) {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { following: { select: { id: true } } },
  });
  const friendIds = me?.following.map((friend) => friend.id) ?? [];
  if (friendIds.length === 0) return [];

  const mine = await shelfIds(userId);
  const theirs = (await shelfIdsFor(friendIds)).filter(
    (id) => !mine.includes(id),
  );
  const [copies, myBooks] = await Promise.all([
    prisma.book.findMany({
      where: { userId: { in: theirs } },
      select: {
        id: true,
        title: true,
        author: true,
        cover: true,
        openLibraryKey: true,
        isbn: true,
        borrowerId: true,
        notLendingUntil: true,
        user: { select: { id: true, firstname: true, surname: true, profileEmoji: true } },
        lendingHistory: { select: { borrowerId: true, borrowedAt: true } },
      },
    }),
    prisma.book.findMany({
      where: { userId: { in: mine } },
      select: { title: true, openLibraryKey: true, isbn: true },
    }),
  ]);

  // Copies of the same book, together
  const books: (typeof copies)[] = [];
  for (const copy of copies) {
    const book = books.find((group) => sameWork(group[0], copy));
    if (book) book.push(copy);
    else books.push([copy]);
  }

  return books
    .filter(
      (group) =>
        !myBooks.some((own) => sameWork(own, group[0])) &&
        !group.some(
          (copy) =>
            copy.borrowerId === userId ||
            copy.lendingHistory.some((loan) => loan.borrowerId === userId),
        ),
    )
    .map((group) => {
      const loans = group.flatMap((copy) => copy.lendingHistory);
      const lastLent = Math.max(
        ...loans.map((loan) => new Date(loan.borrowedAt).getTime()),
      );
      const isFree = (copy: (typeof group)[number]) =>
        copy.borrowerId === null && !isNotLending(copy.notLendingUntil);
      // One that can be asked for now leads
      const lead = group.find(isFree) ?? group[0];
      return {
        id: lead.id,
        title: lead.title,
        author: lead.author,
        cover: lead.cover,
        to: `/books/${lead.id}`,
        loans: loans.length,
        lastLent,
        owners: [
          ...new Set([lead, ...group].map((copy) => copy.user.firstname)),
        ],
        // Their faces, in the same order, for beside the names
        faces: [lead, ...group]
          .map((copy) => copy.user)
          .filter((user, i, all) => all.findIndex((u) => u.id === user.id) === i),
      };
    })
    .filter((book) => book.loans >= MIN_LOANS)
    .sort((a, b) => b.loans - a.loans || b.lastLent - a.lastLent)
    .slice(0, limit);
}
