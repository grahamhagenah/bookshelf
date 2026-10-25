import type { User } from "@prisma/client";

import { plateColorFor, plateColorOf } from "~/components/avatar";
import { prisma } from "~/db.server";
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

// What a public page shows of a shelf: none of the books kept off it
const onPage = (ids: string[]) => ({ userId: { in: ids }, hiddenFromPage: false });

// The header for a shared shelf
export async function getShelfProfile(userId: User["id"]) {
  const ids = await shelfIds(userId);
  const [user, pins, loved, lends, mostLent, books] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { handle: true, bio: true, firstname: true, surname: true, profileEmoji: true },
    }),
    // The books they've pinned, in their order, each with their own
    // reader note on it, if they've written one
    prisma.pin.findMany({
      where: { userId, book: onPage(ids) },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      take: FAVORITES,
      select: {
        book: {
          select: {
            id: true,
            title: true,
            author: true,
            cover: true,
            readerNotes: { where: { userId }, select: { body: true } },
          },
        },
      },
    }),
    // Until they pin some: hearts on books from this shelf, newest first
    prisma.readerNote.findMany({
      where: { userId, loved: true, book: onPage(ids) },
      orderBy: { updatedAt: "desc" },
      take: FAVORITES,
      select: { book: { select: { id: true, title: true, author: true, cover: true } } },
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
    color: plateColorOf(user.profileEmoji) ?? plateColorFor(user.firstname, user.surname),
    pinned: pins.length > 0,
    favorites:
      pins.length > 0
        ? pins.map(({ book: { readerNotes, ...book } }) => ({ ...book, note: readerNotes[0]?.body?.trim() || null }))
        : loved.map((note) => ({ ...note.book, note: null as string | null })),
    stats: {
      books,
      timesLent: lends._sum.lendCount ?? 0,
      mostLent: mostLent ? { title: mostLent.title, times: mostLent.lendCount } : null,
    },
  };
}

// ---- Pins: the owner's own picks for the top of their page ----

// Their pins, in order, for Settings, each with their own note on it
export async function getPins(userId: User["id"]) {
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
          readerNotes: { where: { userId }, select: { body: true } },
        },
      },
    },
  });
  return pins.map(({ id, book: { readerNotes, ...book } }) => ({
    id,
    note: readerNotes[0]?.body?.trim() || null,
    book,
  }));
}

// Where a book stands on their page, for its own page: pinned or not,
// how many pins there are, and whether their note on it would show
export async function getPin(userId: User["id"], bookId: string) {
  const [pin, count, note] = await Promise.all([
    prisma.pin.findUnique({ where: { userId_bookId: { userId, bookId } }, select: { id: true } }),
    prisma.pin.count({ where: { userId } }),
    prisma.readerNote.findUnique({ where: { bookId_userId: { bookId, userId } }, select: { body: true } }),
  ]);
  return { pinned: Boolean(pin), hasNote: Boolean(note?.body?.trim()), count };
}

// Pins a book from their shelf to the end of their page's favorites.
// Says why not when the page already has its five.
export async function pinBook(
  userId: User["id"],
  bookId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ids = await shelfIds(userId);
  const book = await prisma.book.findFirst({ where: { id: bookId, userId: { in: ids } }, select: { id: true } });
  if (!book) return { ok: false, error: "That book isn't on your shelf." };
  const existing = await prisma.pin.findUnique({ where: { userId_bookId: { userId, bookId } } });
  if (existing) return { ok: true };
  const pins = await prisma.pin.findMany({ where: { userId }, select: { position: true } });
  if (pins.length >= PIN_MAX) {
    return { ok: false, error: `Your page shows ${PIN_MAX}. Unpin one first.` };
  }
  const position = pins.reduce((max, pin) => Math.max(max, pin.position + 1), 0);
  await prisma.pin.create({ data: { userId, bookId, position } });
  return { ok: true };
}

export function unpinBook(userId: User["id"], bookId: string) {
  return prisma.pin.deleteMany({ where: { userId, bookId } });
}

// Swaps a pin with its neighbor, earlier or later on the page
export async function movePin(userId: User["id"], bookId: string, direction: "earlier" | "later") {
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
    pins.map((pin, index) => prisma.pin.update({ where: { id: pin.id }, data: { position: index } })),
  );
}

// Keeps a book off (or puts it back on) its shelf's public page
export async function setHiddenFromPage(userId: User["id"], bookId: string, hidden: boolean) {
  const ids = await shelfIds(userId);
  return prisma.book.updateMany({ where: { id: bookId, userId: { in: ids } }, data: { hiddenFromPage: hidden } });
}
