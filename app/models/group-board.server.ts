import { prisma } from "~/db.server";
import type { Group, User } from "~/generated/prisma/client";

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

// The board as the group's page shows it to a member, or null when
// nothing's been set
export async function getGroupBoard(groupId: Group["id"]) {
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
  const pick = group.pickTitle
    ? {
        key: group.pickKey,
        title: group.pickTitle,
        author: group.pickAuthor ?? "",
        cover: group.pickCover ?? "",
        pickedBy: nameOf(group.pickedById),
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
