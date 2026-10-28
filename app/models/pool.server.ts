import { prisma } from "~/db.server";
import type { User } from "~/generated/prisma/client";
import { isNotLending } from "~/lending";
import { normalizeTitle, sameWork } from "~/works";

// Many people's shelves as one: a group's, or all your friends'. Every
// copy of a book is one entry, listing everyone who has it, and the
// searching and filtering happen here, since fifty people's shelves can
// run to thousands of books.

const shelfBook = {
  id: true,
  title: true,
  author: true,
  cover: true,
  borrowerId: true,
  notLendingUntil: true,
  createdAt: true,
  lendCount: true,
  user: { select: { id: true, firstname: true } },
} as const;

interface ShelfRow {
  id: string;
  title: string;
  author: string;
  cover: string;
  borrowerId: string | null;
  notLendingUntil: Date | null;
  createdAt: Date;
  lendCount: number;
  user: { id: string; firstname: string };
}

export const POOL_PAGE = 48;
export const POOL_ROW = 12;
// The most books one search gathers before putting copies together
const SEARCH_LIMIT = 5000;

// Popular is the most lent first, as Most borrowed on the home
// page counts it
export const POOL_SORTS = ["newest", "popular", "title", "author"] as const;
export type PoolSort = (typeof POOL_SORTS)[number];

// Two copies are the same book when title and author's surname match:
// "Dune" by Frank Herbert on two shelves is one entry, two "Emma"s by
// different authors are two
function workKey(book: { title: string; author: string }) {
  const surname = book.author.split(/,|&| and /)[0].trim().split(/\s+/).pop() ?? "";
  return `${normalizeTitle(book.title)}|${surname.toLowerCase().replace(/[^a-z]/g, "")}`;
}

// The same book on several shelves, as one entry with every copy, the
// ones you could borrow now first. Kept in the order they came in.
function asWorks(books: ShelfRow[], now = new Date()) {
  const works = new Map<
    string,
    {
      key: string;
      title: string;
      author: string;
      cover: string;
      addedAt: Date;
      // Times its copies here have been lent, all told
      loans: number;
      copies: { bookId: string; owner: { id: string; firstname: string }; available: boolean; lent: boolean }[];
    }
  >();
  for (const book of books) {
    const key = workKey(book);
    const copy = {
      bookId: book.id,
      owner: book.user,
      lent: Boolean(book.borrowerId),
      available: !book.borrowerId && !isNotLending(book.notLendingUntil, now),
    };
    const work = works.get(key);
    if (work) {
      work.copies.push(copy);
      if (!work.cover && book.cover) work.cover = book.cover;
      if (book.createdAt > work.addedAt) work.addedAt = book.createdAt;
      work.loans += book.lendCount;
    } else {
      works.set(key, {
        key,
        title: book.title,
        author: book.author,
        cover: book.cover,
        addedAt: book.createdAt,
        loans: book.lendCount,
        copies: [copy],
      });
    }
  }
  return [...works.values()].map((work) => ({
    ...work,
    copies: [...work.copies].sort((a, b) => Number(b.available) - Number(a.available)),
  }));
}
export type PoolWork = ReturnType<typeof asWorks>[number];

const byTitle = (title: string) => title.replace(/^(the|a|an)\s+/i, "");
const surnameOf = (author: string) => author.split(/,|&| and /)[0].trim().split(/\s+/).pop() ?? author;

export const POOL_STATUSES = ["all", "available", "lent"] as const;
export type PoolStatus = (typeof POOL_STATUSES)[number];

export interface PoolSearch {
  q?: string;
  // One person's books
  who?: string | null;
  // Books with a copy free now, or with every copy out
  status?: PoolStatus;
  sort?: PoolSort;
  shown?: number;
  // Books already shown above (by work), left out of the list but still
  // counted
  exclude?: string[];
}

const isFree = (work: PoolWork) => work.copies.some((copy) => copy.available);
const isOut = (work: PoolWork) => !isFree(work) && work.copies.some((copy) => copy.lent);

// Searching the shelves, one entry per book, with how many
// match each filter. Done here rather than in the browser: fifty
// people's shelves can run to thousands.
export async function searchPool(
  openIds: string[],
  { q = "", who = null, status = "all", sort = "newest", shown = POOL_PAGE, exclude = [] }: PoolSearch,
) {
  const ids = who ? openIds.filter((id) => id === who) : openIds;
  const term = q.trim();
  const books = await prisma.book.findMany({
    where: {
      userId: { in: ids },
      ...(term ? { OR: [{ title: { contains: term } }, { author: { contains: term } }] } : {}),
    },
    select: shelfBook,
    orderBy: { createdAt: "desc" },
    take: SEARCH_LIMIT,
  });
  const all = asWorks(books);
  const counts = { all: all.length, available: all.filter(isFree).length, lent: all.filter(isOut).length };
  const left = new Set(exclude);
  const works = (status === "available" ? all.filter(isFree) : status === "lent" ? all.filter(isOut) : all).filter(
    (work) => !left.has(work.key),
  );
  if (sort === "popular") {
    // Most lent first; the rest stay newest first
    works.sort((a, b) => b.loans - a.loans);
  } else if (sort === "title") {
    works.sort((a, b) => byTitle(a.title).localeCompare(byTitle(b.title)));
  } else if (sort === "author") {
    works.sort(
      (a, b) =>
        surnameOf(a.author).localeCompare(surnameOf(b.author)) ||
        byTitle(a.title).localeCompare(byTitle(b.title)),
    );
  }
  return { works: works.slice(0, shown), total: works.length, counts };
}

// The top of the shelf: what's on your want-to-read list that someone
// here owns, one entry per book, the ones you could borrow first
export async function getPoolWanted(userId: User["id"], openIds: string[]) {
  const [wishes, candidates] = await Promise.all([
    prisma.wantToRead.findMany({
      where: { userId },
      select: { title: true, openLibraryKey: true, isbn: true },
    }),
    prisma.book.findMany({
      where: { userId: { in: openIds } },
      select: { id: true, title: true, openLibraryKey: true, isbn: true },
    }),
  ]);
  const wantedIds = candidates
    .filter((book) => wishes.some((wish) => sameWork(wish, book)))
    .map((book) => book.id);
  const wanted = asWorks(
    await prisma.book.findMany({
      where: { id: { in: wantedIds } },
      select: shelfBook,
      orderBy: { createdAt: "desc" },
    }),
  )
    .sort((a, b) => Number(isFree(b)) - Number(isFree(a)))
    .slice(0, POOL_ROW);
  return { wanted };
}

// How many books there are across these shelves: books, not copies, so
// five people's Dune is one
export async function countPoolBooks(openIds: string[]) {
  const books = await prisma.book.findMany({
    where: { userId: { in: openIds } },
    select: { title: true, author: true },
  });
  return new Set(books.map(workKey)).size;
}
