import { prisma } from "~/db.server";
import type { Group, User } from "~/generated/prisma/client";
import { isNotLending } from "~/lending";
import { sameWork } from "~/works";

import { circleOf } from "./circle.server";

// What a group can choose to keep on its page, if it plans here rather
// than in its chat: the book it's reading, when and where it next meets,
// and a link to that chat. All optional, and any member can set or clear
// any of it; the page says who changed it last.

export interface PickWork {
  // The Open Library work, /works/OL…W, or null for a book without one
  key: string | null;
  title: string;
  author: string;
  cover: string;
}

const PLACE_MAX = 120;
const URL_MAX = 300;

const isMember = (groupId: Group["id"], userId: User["id"]) =>
  prisma.groupMember.count({ where: { groupId, userId } }).then(Boolean);

const changedBy = (userId: User["id"]) => ({ boardById: userId, boardAt: new Date() });

// A new book for the group. Picking the same book again changes nothing,
// so it isn't announced twice
export async function setGroupPick(userId: User["id"], groupId: Group["id"], work: PickWork) {
  const title = work.title.trim();
  if (!title || !(await isMember(groupId, userId))) return false;
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { pickKey: true, pickTitle: true },
  });
  if (group?.pickTitle === title && group.pickKey === work.key) return true;
  await prisma.group.update({
    where: { id: groupId },
    data: {
      pickKey: work.key,
      pickTitle: title.slice(0, 300),
      pickAuthor: work.author.trim().slice(0, 300),
      pickCover: work.cover,
      pickedById: userId,
      pickedAt: new Date(),
      ...changedBy(userId),
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
      ...changedBy(userId),
    },
  });
  return true;
}

// When and where they next meet; either can be left out, and leaving both
// out takes the meetup off
export async function setGroupMeeting(
  userId: User["id"],
  groupId: Group["id"],
  { at, place }: { at: Date | null; place: string },
) {
  if (!(await isMember(groupId, userId))) return false;
  await prisma.group.update({
    where: { id: groupId },
    data: {
      meetsAt: at,
      meetPlace: place.trim().slice(0, PLACE_MAX) || null,
      ...changedBy(userId),
    },
  });
  return true;
}

// The group chat's link, as an http(s) address; anything else, or nothing,
// takes it off
export function cleanChatUrl(value: unknown) {
  if (typeof value !== "string") return null;
  let text = value.trim();
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) text = `https://${text}`;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString().slice(0, URL_MAX);
  } catch {
    return null;
  }
}

export async function setGroupChat(userId: User["id"], groupId: Group["id"], url: string | null) {
  if (!(await isMember(groupId, userId))) return false;
  await prisma.group.update({
    where: { id: groupId },
    data: { chatUrl: url, ...changedBy(userId) },
  });
  return true;
}

// The chat's app, for its button: "Join on WhatsApp"
export function chatApp(url: string) {
  const host = new URL(url).hostname.replace(/^www\./, "");
  const apps: [RegExp, string][] = [
    [/(^|\.)whatsapp\.com$|^wa\.me$/, "WhatsApp"],
    [/(^|\.)signal\.(group|org)$/, "Signal"],
    [/(^|\.)discord\.(gg|com)$/, "Discord"],
    [/(^|\.)t\.me$|(^|\.)telegram\.(me|org)$/, "Telegram"],
    [/(^|\.)groupme\.com$/, "GroupMe"],
    [/(^|\.)slack\.com$/, "Slack"],
    [/(^|\.)facebook\.com$|(^|\.)messenger\.com$|^m\.me$/, "Messenger"],
  ];
  return apps.find(([pattern]) => pattern.test(host))?.[1] ?? null;
}

// Around the pick, what the group needs to read it together: the copies
// among them (yours, friends', and group-mates' unless they keep it off
// their page), free ones first, and who's finished it, by any read mark
async function aroundThePick(
  userId: User["id"],
  memberIds: User["id"][],
  work: { title: string; openLibraryKey: string | null },
) {
  const [books, readerNotes, workNotes, asked, circle] = await Promise.all([
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
    prisma.readerNote.findMany({
      where: { userId: { in: memberIds }, readAt: { not: null } },
      select: { userId: true, book: { select: { title: true, openLibraryKey: true, isbn: true } } },
    }),
    work.openLibraryKey
      ? prisma.workNote.findMany({
          where: { userId: { in: memberIds }, workKey: work.openLibraryKey, readAt: { not: null } },
          select: { userId: true },
        })
      : Promise.resolve([]),
    prisma.notification.findMany({
      where: { type: "BOOK_REQUEST", senderId: userId, read: false, bookId: { not: null } },
      select: { bookId: true },
    }),
    circleOf(userId),
  ]);
  const requested = new Set(asked.map((request) => request.bookId));
  const copies = books
    .filter((book) => sameWork(work, book))
    .filter((book) => book.userId === userId || !book.hiddenFromPage || circle.friends.has(book.userId))
    .map((book) => {
      const notLending = isNotLending(book.notLendingUntil);
      return {
        bookId: book.id,
        ownerId: book.userId,
        mine: book.userId === userId,
        available: book.borrowerId === null && !notLending,
        notLending,
        borrowerId: book.borrowerId,
        requested: requested.has(book.id),
      };
    })
    .sort((a, b) => Number(b.available) - Number(a.available));
  const finished = new Set([
    ...books.filter((book) => book.readAt && sameWork(work, book)).map((book) => book.userId),
    ...readerNotes.filter((note) => sameWork(work, note.book)).map((note) => note.userId),
    ...workNotes.map((note) => note.userId),
  ]);
  return { copies, finished };
}

// The board as the group's page shows it to a member, or null when
// nothing's been set
export async function getGroupBoard(groupId: Group["id"], userId: User["id"]) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      pickKey: true,
      pickTitle: true,
      pickAuthor: true,
      pickCover: true,
      pickedById: true,
      meetsAt: true,
      meetPlace: true,
      chatUrl: true,
      boardById: true,
      boardAt: true,
      members: { select: { user: { select: { id: true, firstname: true } } } },
    },
  });
  if (!group) return null;
  const nameOf = (id: string | null) =>
    group.members.find((member) => member.user.id === id)?.user ?? null;
  const members = group.members.map((member) => member.user);
  const around = group.pickTitle
    ? await aroundThePick(
        userId,
        members.map((member) => member.id),
        { title: group.pickTitle, openLibraryKey: group.pickKey },
      )
    : null;
  const pick = group.pickTitle
    ? {
        key: group.pickKey,
        title: group.pickTitle,
        author: group.pickAuthor ?? "",
        cover: group.pickCover ?? "",
        pickedBy: nameOf(group.pickedById),
        copies: (around?.copies ?? []).map(({ ownerId, ...copy }) => ({
          ...copy,
          owner: nameOf(ownerId) ?? { id: ownerId, firstname: "" },
        })),
        finished: members.filter((member) => around?.finished.has(member.id)),
        memberCount: members.length,
      }
    : null;
  const meeting =
    group.meetsAt || group.meetPlace ? { at: group.meetsAt, place: group.meetPlace } : null;
  const chat = group.chatUrl ? { url: group.chatUrl, app: chatApp(group.chatUrl) } : null;
  return {
    pick,
    meeting,
    chat,
    // Who changed it last, when there's anything on it
    changed:
      (pick || meeting || chat) && group.boardAt
        ? { by: nameOf(group.boardById), at: group.boardAt }
        : null,
  };
}

// The meetup as a calendar file (.ics), for a member's own calendar. Its
// time is kept as typed, so it goes in "floating": 7pm wherever the
// calendar is. A date without a time is an all-day event.
export function meetupCalendar({
  groupId,
  name,
  at,
  place,
  pick,
  url,
}: {
  groupId: string;
  name: string;
  at: Date;
  place: string | null;
  pick: { title: string; author: string } | null;
  url: string;
}) {
  const text = (value: string) =>
    value.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
  const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const day = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, "");
  const allDay = at.getUTCHours() === 0 && at.getUTCMinutes() === 0;
  // Two hours, as a book club's evening goes
  const end = new Date(at.getTime() + (allDay ? 24 : 2) * 60 * 60 * 1000);
  const floating = (date: Date) => stamp(date).replace(/Z$/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Stacks//Group meetup//EN",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${groupId}-${stamp(at)}@bookstacks.app`,
    `DTSTAMP:${stamp(new Date())}`,
    allDay ? `DTSTART;VALUE=DATE:${day(at)}` : `DTSTART:${floating(at)}`,
    allDay ? `DTEND;VALUE=DATE:${day(end)}` : `DTEND:${floating(end)}`,
    `SUMMARY:${text(pick ? `${name}: ${pick.title}` : name)}`,
    ...(place ? [`LOCATION:${text(place)}`] : []),
    `DESCRIPTION:${text([pick ? `Reading ${pick.title}${pick.author ? ` by ${pick.author}` : ""}` : null, url].filter(Boolean).join("\n"))}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.join("\r\n")}\r\n`;
}
