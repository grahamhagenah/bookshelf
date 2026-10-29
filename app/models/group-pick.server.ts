import { prisma } from "~/db.server";
import type { Group, User } from "~/generated/prisma/client";
import { isNotLending } from "~/lending";
import { sameWork } from "~/works";

import { circleOf } from "./circle.server";

// What a group is reading now: one book any member picks, and when they
// next meet. Around it, what the group needs to read it together: who has
// a copy (and whether it's free), who's finished, and what they thought.

export interface PickWork {
  // The Open Library work, /works/OL…W, or null for a book without one
  key: string | null;
  title: string;
  author: string;
  cover: string;
}

const isMember = (groupId: Group["id"], userId: User["id"]) =>
  prisma.groupMember.count({ where: { groupId, userId } }).then(Boolean);

// Any member can pick it, or change it; the meeting date goes with the
// book it was for
export async function setGroupPick(userId: User["id"], groupId: Group["id"], work: PickWork) {
  if (!(await isMember(groupId, userId)) || !work.title.trim()) return false;
  await prisma.group.update({
    where: { id: groupId },
    data: {
      pickKey: work.key,
      pickTitle: work.title.trim(),
      pickAuthor: work.author.trim(),
      pickCover: work.cover,
      pickedById: userId,
      pickedAt: new Date(),
      meetsAt: null,
    },
  });
  return true;
}

export async function clearGroupPick(userId: User["id"], groupId: Group["id"]) {
  if (!(await isMember(groupId, userId))) return false;
  await prisma.group.update({
    where: { id: groupId },
    data: {
      pickKey: null,
      pickTitle: null,
      pickAuthor: null,
      pickCover: null,
      pickedById: null,
      pickedAt: null,
      meetsAt: null,
    },
  });
  return true;
}

// When the group next meets about it; null takes the date off
export async function setGroupMeeting(userId: User["id"], groupId: Group["id"], meetsAt: Date | null) {
  if (!(await isMember(groupId, userId))) return false;
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { pickTitle: true } });
  if (!group?.pickTitle) return false;
  await prisma.group.update({ where: { id: groupId }, data: { meetsAt } });
  return true;
}

// Your groups, for picking a book from its page: whether each is reading
// this one already
export async function groupsToPick(userId: User["id"], work: { key: string | null; title: string }) {
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, pickKey: true, pickTitle: true },
  });
  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    reading:
      group.pickTitle !== null &&
      sameWork({ title: group.pickTitle, openLibraryKey: group.pickKey }, { title: work.title, openLibraryKey: work.key }),
  }));
}

// The pick as the group's page shows it to one member, or null when
// there's none (or they're not in the group)
export async function getGroupPick(groupId: Group["id"], userId: User["id"]) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      pickKey: true,
      pickTitle: true,
      pickAuthor: true,
      pickCover: true,
      pickedById: true,
      pickedAt: true,
      meetsAt: true,
      members: { select: { user: { select: { id: true, firstname: true } } } },
    },
  });
  if (!group?.pickTitle) return null;
  const members = group.members.map((member) => member.user);
  const memberIds = members.map((member) => member.id);
  if (!memberIds.includes(userId)) return null;
  const work = { title: group.pickTitle, openLibraryKey: group.pickKey };
  const nameOf = (id: string) => members.find((member) => member.id === id)?.firstname ?? "";

  const [books, readerNotes, workNotes, circle] = await Promise.all([
    // Members' copies, matched by work (or title, for books without one)
    prisma.book.findMany({
      where: { userId: { in: memberIds } },
      select: {
        id: true,
        title: true,
        openLibraryKey: true,
        isbn: true,
        userId: true,
        borrowerId: true,
        notLendingUntil: true,
        hiddenFromPage: true,
        readAt: true,
      },
    }),
    // What members marked and wrote on any copy of it
    prisma.readerNote.findMany({
      where: { userId: { in: memberIds } },
      select: {
        userId: true,
        readAt: true,
        loved: true,
        body: true,
        updatedAt: true,
        book: { select: { title: true, openLibraryKey: true, isbn: true } },
      },
    }),
    group.pickKey
      ? prisma.workNote.findMany({
          where: { userId: { in: memberIds }, workKey: group.pickKey },
          select: { userId: true, readAt: true, loved: true, body: true, updatedAt: true },
        })
      : Promise.resolve([]),
    circleOf(userId),
  ]);

  // Copies: yours, friends', and group-mates' unless they keep it off
  // their page
  const copies = books
    .filter((book) => sameWork(work, book))
    .filter((book) => book.userId === userId || !book.hiddenFromPage || circle.friends.has(book.userId))
    .map((book) => {
      const notLending = isNotLending(book.notLendingUntil);
      return {
        bookId: book.id,
        owner: { id: book.userId, firstname: nameOf(book.userId) },
        mine: book.userId === userId,
        available: book.borrowerId === null && !notLending,
        notLending,
        borrowerId: book.borrowerId,
      };
    })
    // The ones free to borrow first, then the rest
    .sort((a, b) => Number(b.available) - Number(a.available));

  const notesOnIt = readerNotes.filter((note) => sameWork(work, note.book));
  const finishedIds = new Set([
    ...books.filter((book) => book.readAt && sameWork(work, book)).map((book) => book.userId),
    ...notesOnIt.filter((note) => note.readAt).map((note) => note.userId),
    ...workNotes.filter((note) => note.readAt).map((note) => note.userId),
  ]);
  // One note per member, their latest, newest first
  const written = [...notesOnIt, ...workNotes]
    .filter((note) => note.body)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  const notes = written
    .filter((note, index) => written.findIndex((other) => other.userId === note.userId) === index)
    .map((note) => ({
      userId: note.userId,
      firstname: nameOf(note.userId),
      body: note.body as string,
      loved: note.loved,
    }));

  return {
    key: group.pickKey,
    title: group.pickTitle,
    author: group.pickAuthor ?? "",
    cover: group.pickCover ?? "",
    pickedBy: group.pickedById ? { id: group.pickedById, firstname: nameOf(group.pickedById) } : null,
    pickedAt: group.pickedAt,
    meetsAt: group.meetsAt,
    copies,
    finished: members.filter((member) => finishedIds.has(member.id)),
    memberCount: members.length,
    notes,
  };
}
