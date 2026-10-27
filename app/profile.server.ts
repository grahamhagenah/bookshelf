
import { plateColorFor, plateColorOf } from "~/components/avatar";
import { prisma } from "~/db.server";
import type { User } from "~/generated/prisma/client";
import { shelfIds } from "~/models/household.server";
import { BIO_MAX, PIN_MAX, handleProblem, normalizeHandle } from "~/profile";

// A shared shelf's own page: its @handle address, a line about its owner,
// the books they've loved most recently, and a few numbers

export async function getUserByHandle(handle: string) {
  return prisma.user.findUnique({
    where: { handle: normalizeHandle(handle) },
    select: { id: true, shareToken: true },
  });
}

// Saves a handle and bio; says what's wrong instead when it can't
export async function saveProfile(
  userId: User["id"],
  input: { handle: string; bio: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const handle = normalizeHandle(input.handle);
  const bio = input.bio.trim().replace(/\s+/g, " ").slice(0, BIO_MAX);
  if (handle) {
    const problem = handleProblem(handle);
    if (problem) return { ok: false, error: problem };
    const taken = await prisma.user.findFirst({
      where: { handle, id: { not: userId } },
      select: { id: true },
    });
    if (taken) return { ok: false, error: `@${handle} is taken. Try another.` };
  }
  await prisma.user.update({
    where: { id: userId },
    data: { handle: handle || null, bio: bio || null },
  });
  return { ok: true };
}

const FAVORITES = PIN_MAX;

// A note in a bubble on the public page: its opening paragraph, which
// ends where the writer chose to, rather than wherever the bubble runs out
const firstParagraph = (body: string | null | undefined) =>
  body
    ?.trim()
    .split(/\n\s*\n/)[0]
    .trim() || null;

// What a public page shows of a shelf: none of the books kept off it
const onPage = (ids: string[]) => ({
  userId: { in: ids },
  hiddenFromPage: false,
});

// What can be among their favorites: a book from their shelf, or one
// they've borrowed from a friend, unless whoever owns it keeps it off
// their own page
const canFavorite = (ids: string[], userId: User["id"]) => ({
  hiddenFromPage: false,
  OR: [
    { userId: { in: ids } },
    { lendingHistory: { some: { borrowerId: userId } } },
  ],
});

// The header for a shared shelf
export async function getShelfProfile(userId: User["id"]) {
  const ids = await shelfIds(userId);
  const [user, pins, loved, lovedElsewhere, lends, mostLent, books] =
    await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          handle: true,
          bio: true,
          firstname: true,
          surname: true,
          profileEmoji: true,
        },
      }),
      // The books they've pinned, in their order, each with their own
      // reader note on it, if they've written one
      prisma.pin.findMany({
        where: { userId, book: canFavorite(ids, userId) },
        orderBy: [{ position: "asc" }, { createdAt: "asc" }],
        take: FAVORITES,
        select: {
          book: {
            select: {
              id: true,
              title: true,
              author: true,
              cover: true,
              userId: true,
              readerNotes: { where: { userId }, select: { body: true } },
            },
          },
        },
      }),
      // Until they pin some: their hearts, newest first
      prisma.readerNote.findMany({
        where: { userId, loved: true, book: canFavorite(ids, userId) },
        orderBy: { updatedAt: "desc" },
        take: FAVORITES,
        select: {
          updatedAt: true,
          book: {
            select: {
              id: true,
              title: true,
              author: true,
              cover: true,
              userId: true,
            },
          },
        },
      }),
      // And hearts on books they read somewhere else
      prisma.workNote.findMany({
        where: { userId, loved: true },
        orderBy: { updatedAt: "desc" },
        take: FAVORITES,
        select: {
          id: true,
          title: true,
          author: true,
          cover: true,
          updatedAt: true,
        },
      }),
      // Every time a book from this shelf has gone out on loan
      prisma.book.aggregate({ where: onPage(ids), _sum: { lendCount: true } }),
      prisma.book.findFirst({
        where: { ...onPage(ids), lendCount: { gt: 0 } },
        orderBy: [{ lendCount: "desc" }, { createdAt: "asc" }],
        select: { title: true, lendCount: true },
      }),
      prisma.book.count({ where: onPage(ids) }),
    ]);
  return {
    handle: user.handle,
    bio: user.bio,
    // The page's color: their bookplate's, or the one their name gives
    color:
      plateColorOf(user.profileEmoji) ??
      plateColorFor(user.firstname, user.surname),
    pinned: pins.length > 0,
    // Each says whether it's from this shelf, and so has a page to open,
    // and never whose it is when it isn't
    favorites:
      pins.length > 0
        ? pins.map(({ book: { readerNotes, userId: ownerId, ...book } }) => ({
            ...book,
            onShelf: ids.includes(ownerId),
            note: firstParagraph(readerNotes[0]?.body),
          }))
        : [
            ...loved.map(
              ({ updatedAt, book: { userId: ownerId, ...book } }) => ({
                ...book,
                updatedAt,
                onShelf: ids.includes(ownerId),
              }),
            ),
            ...lovedElsewhere.map((work) => ({ ...work, onShelf: false })),
          ]
            .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
            .slice(0, FAVORITES)
            .map(({ id, title, author, cover, onShelf }) => ({
              id,
              title,
              author,
              cover,
              onShelf,
              note: null as string | null,
            })),
    stats: {
      books,
      timesLent: lends._sum.lendCount ?? 0,
      mostLent: mostLent
        ? { title: mostLent.title, times: mostLent.lendCount }
        : null,
    },
  };
}

// ---- Pins: the owner's own picks for the top of their page ----

// Their pins, in order, for Settings, each with their own note on it
export async function getPins(userId: User["id"]) {
  const ids = await shelfIds(userId);
  const pins = await prisma.pin.findMany({
    where: { userId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      book: {
        select: {
          id: true,
          title: true,
          author: true,
          cover: true,
          hiddenFromPage: true,
          userId: true,
          readerNotes: { where: { userId }, select: { body: true } },
        },
      },
    },
  });
  return pins.map(
    ({ id, book: { readerNotes, userId: ownerId, ...book } }) => ({
      id,
      note: readerNotes[0]?.body?.trim() || null,
      // A friend's book they borrowed; whether it shows is the friend's call
      borrowed: !ids.includes(ownerId),
      book,
    }),
  );
}

// Where a book stands on their page, for its own page: pinned or not,
// how many pins there are, and whether their note on it would show
export async function getPin(userId: User["id"], bookId: string) {
  const [pin, count, note] = await Promise.all([
    prisma.pin.findUnique({
      where: { userId_bookId: { userId, bookId } },
      select: { id: true },
    }),
    prisma.pin.count({ where: { userId } }),
    prisma.readerNote.findUnique({
      where: { bookId_userId: { bookId, userId } },
      select: { body: true },
    }),
  ]);
  return { pinned: Boolean(pin), hasNote: Boolean(note?.body?.trim()), count };
}

// Pins a book from their shelf, or one they've borrowed, to the end of
// their page's favorites. Says why not when it can't.
export async function pinBook(
  userId: User["id"],
  bookId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ids = await shelfIds(userId);
  const book = await prisma.book.findFirst({
    where: {
      id: bookId,
      OR: [
        { userId: { in: ids } },
        { lendingHistory: { some: { borrowerId: userId } } },
      ],
    },
    select: { userId: true, hiddenFromPage: true },
  });
  if (!book)
    return {
      ok: false,
      error: "Only books from your shelf, or ones you've borrowed.",
    };
  if (book.hiddenFromPage && !ids.includes(book.userId)) {
    return { ok: false, error: "Its owner keeps it off public pages." };
  }
  const existing = await prisma.pin.findUnique({
    where: { userId_bookId: { userId, bookId } },
  });
  if (existing) return { ok: true };
  const pins = await prisma.pin.findMany({
    where: { userId },
    select: { position: true },
  });
  if (pins.length >= PIN_MAX) {
    return { ok: false, error: `Your page shows ${PIN_MAX}. Unpin one first.` };
  }
  const position = pins.reduce(
    (max, pin) => Math.max(max, pin.position + 1),
    0,
  );
  await prisma.pin.create({ data: { userId, bookId, position } });
  return { ok: true };
}

export function unpinBook(userId: User["id"], bookId: string) {
  return prisma.pin.deleteMany({ where: { userId, bookId } });
}

// Swaps a pin with its neighbor, earlier or later on the page
export async function movePin(
  userId: User["id"],
  bookId: string,
  direction: "earlier" | "later",
) {
  const pins = await prisma.pin.findMany({
    where: { userId },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    select: { id: true, bookId: true },
  });
  const at = pins.findIndex((pin) => pin.bookId === bookId);
  const to = direction === "earlier" ? at - 1 : at + 1;
  if (at === -1 || to < 0 || to >= pins.length) return;
  [pins[at], pins[to]] = [pins[to], pins[at]];
  // Positions written fresh, so old ties can't confuse the order
  await prisma.$transaction(
    pins.map((pin, index) =>
      prisma.pin.update({ where: { id: pin.id }, data: { position: index } }),
    ),
  );
}

// Keeps a book off (or puts it back on) its shelf's public page
export async function setHiddenFromPage(
  userId: User["id"],
  bookId: string,
  hidden: boolean,
) {
  const ids = await shelfIds(userId);
  return prisma.book.updateMany({
    where: { id: bookId, userId: { in: ids } },
    data: { hiddenFromPage: hidden },
  });
}
