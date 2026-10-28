import { prisma } from "~/db.server";
import type { User } from "~/generated/prisma/client";
import { isbnForms } from "~/isbn";

import { lendToFriend, returnBook } from "./book.server";
import { handOn } from "./hold.server";
import { shelfIds } from "./household.server";
import { nameList } from "./name-list.server";
import { lookupIsbn } from "./openlibrary.server";

// The check-out desk: scan a book from your shelf and lend it to a name
// in one tap, or scan it again when it comes back. For a classroom, a
// little library, or any shelf lent by name.

const copy = {
  id: true,
  title: true,
  author: true,
  cover: true,
  isbn: true,
  openLibraryKey: true,
  dueDate: true,
  borrowedAt: true,
  borrower: { select: { id: true, firstname: true, surname: true, nameOnly: true } },
} as const;

// Not long enough for a scan to keep someone waiting
const LOOKUP_MS = 4000;

// Your copies of what was scanned or typed: by ISBN, either way of writing
// it, then by the work Open Library says that ISBN is (another edition of
// the same book). Typed words find titles and authors.
export async function findOnShelf(userId: User["id"], query: string) {
  const shelf = await shelfIds(userId);
  const forms = isbnForms(query);
  if (forms.length) {
    const byIsbn = await prisma.book.findMany({
      where: { userId: { in: shelf }, isbn: { in: forms } },
      select: copy,
      orderBy: { createdAt: "asc" },
    });
    if (byIsbn.length) return byIsbn;
    const work = await lookupIsbn(forms[0], LOOKUP_MS).catch(() => null);
    if (!work?.key) return [];
    return prisma.book.findMany({
      where: { userId: { in: shelf }, openLibraryKey: work.key },
      select: copy,
      orderBy: { createdAt: "asc" },
    });
  }

  const words = query.trim();
  if (words.length < 2) return [];
  return prisma.book.findMany({
    where: {
      userId: { in: shelf },
      OR: [{ title: { contains: words } }, { author: { contains: words } }],
    },
    select: copy,
    orderBy: [{ title: "asc" }, { createdAt: "asc" }],
    take: 30,
  });
}

// Everything out from your shelf, whoever has it, soonest due first
// How many books are on the shelf to lend, so an empty desk can say so
export async function shelfBookCount(userId: User["id"]) {
  return prisma.book.count({ where: { userId: { in: await shelfIds(userId) } } });
}

export async function loansOut(userId: User["id"]) {
  return prisma.book.findMany({
    where: { userId: { in: await shelfIds(userId) }, borrowerId: { not: null } },
    select: copy,
    orderBy: [{ dueDate: "asc" }, { borrowedAt: "asc" }],
  });
}

// One of these copies that's on the shelf, to someone on your list of
// names. Of several copies (a class set), the first one in goes.
export async function checkOut(
  userId: User["id"],
  { bookIds, personId, weeks }: { bookIds: string[]; personId: string; weeks: number },
) {
  const shelf = await shelfIds(userId);
  const [book, names] = await Promise.all([
    prisma.book.findFirst({
      where: { id: { in: bookIds }, userId: { in: shelf }, borrowerId: null },
      select: { id: true, title: true },
      orderBy: { createdAt: "asc" },
    }),
    nameList(userId),
  ]);
  const person = names.find((name) => name.id === personId);
  if (!book || !person) return null;
  const lent = await lendToFriend(book.id, userId, person.id, weeks);
  return { title: book.title, person, dueDate: lent.dueDate };
}

// It's back on the shelf, and whoever's waiting for it is asked
export async function checkIn(userId: User["id"], bookId: string) {
  const book = await prisma.book.findFirst({
    where: { id: bookId, userId: { in: await shelfIds(userId) }, borrowerId: { not: null } },
    select: { id: true, title: true, borrower: { select: { firstname: true, surname: true } } },
  });
  if (!book) return null;
  await returnBook(book.id);
  await handOn(book.id, userId);
  return { title: book.title, person: book.borrower };
}
