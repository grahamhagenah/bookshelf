import type { User } from "@prisma/client";

import { prisma } from "~/db.server";
import { shelfIds } from "~/models/household.server";
import { BIO_MAX, handleProblem, normalizeHandle } from "~/profile";

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

const FAVORITES = 5;

// The header for a shared shelf
export async function getShelfProfile(userId: User["id"]) {
  const ids = await shelfIds(userId);
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const [user, loved, readByNote, readOnShelf, mostLent, books] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { handle: true, bio: true } }),
    // Hearts on books from this shelf, newest first
    prisma.readerNote.findMany({
      where: { userId, loved: true, book: { userId: { in: ids } } },
      orderBy: { updatedAt: "desc" },
      take: FAVORITES,
      select: { book: { select: { id: true, title: true, author: true, cover: true } } },
    }),
    prisma.readerNote.findMany({
      where: { userId, readAt: { gte: yearStart } },
      select: { bookId: true },
    }),
    prisma.book.findMany({
      where: { userId, readAt: { gte: yearStart } },
      select: { id: true },
    }),
    prisma.book.findFirst({
      where: { userId: { in: ids }, lendCount: { gt: 0 } },
      orderBy: [{ lendCount: "desc" }, { createdAt: "asc" }],
      select: { title: true, lendCount: true },
    }),
    prisma.book.count({ where: { userId: { in: ids } } }),
  ]);
  const read = new Set([...readByNote.map((note) => note.bookId), ...readOnShelf.map((book) => book.id)]);
  return {
    handle: user.handle,
    bio: user.bio,
    favorites: loved.map((note) => note.book),
    stats: {
      books,
      readThisYear: read.size,
      mostLent: mostLent ? { title: mostLent.title, times: mostLent.lendCount } : null,
    },
  };
}
