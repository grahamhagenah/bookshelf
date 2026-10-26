import type { Group, User } from "@prisma/client";

import { prisma } from "~/db.server";

import { canInteract } from "./demo.server";
import { createFriendship } from "./user.server";

// Groups: a book club, an office, a family. Joining one makes you friends
// with everyone already in it, so all their shelves open up at once, and
// whoever joins later becomes your friend too. Leaving keeps the
// friendships you made; those are between people, not the group.

export const GROUP_NAME_MAX = 60;
// Big enough for a club or an office, small enough that joining one
// doesn't fill your friends list with strangers
export const GROUP_MAX_MEMBERS = 50;

const newToken = () => crypto.randomUUID().replace(/-/g, "").slice(0, 16);

export function cleanGroupName(name: unknown) {
  return typeof name === "string" ? name.trim().replace(/\s+/g, " ").slice(0, GROUP_NAME_MAX) : "";
}

const isMember = (groupId: Group["id"], userId: User["id"]) =>
  prisma.groupMember.count({ where: { groupId, userId } }).then(Boolean);

export async function createGroup(userId: User["id"], name: string) {
  return prisma.group.create({
    data: { name, inviteToken: newToken(), members: { create: { userId } } },
    select: { id: true },
  });
}

const person = { id: true, firstname: true, surname: true, profileEmoji: true } as const;

// The groups someone is in, with a few faces from each
export async function getMyGroups(userId: User["id"]) {
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      _count: { select: { members: true } },
      members: { orderBy: { joinedAt: "asc" }, take: 5, select: { user: { select: person } } },
    },
  });
  return groups.map((group) => ({
    id: group.id,
    name: group.name,
    memberCount: group._count.members,
    faces: group.members.map((member) => member.user),
  }));
}

// Everything the group's page shows, for someone in it: who's in it and
// the books on their shelves, newest first. Shelves of anyone you've since
// unfriended stay closed, as they would anywhere else.
export async function getGroup(groupId: Group["id"], userId: User["id"], { shelfSize = 60 } = {}) {
  if (!(await isMember(groupId, userId))) return null;
  const [group, me] = await Promise.all([
    prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        inviteToken: true,
        members: {
          orderBy: { joinedAt: "asc" },
          select: {
            joinedAt: true,
            user: { select: { ...person, _count: { select: { books: true } } } },
          },
        },
      },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { following: { select: { id: true } } },
    }),
  ]);
  if (!group) return null;
  const friendIds = new Set(me.following.map((friend) => friend.id));
  const open = group.members
    .map((member) => member.user.id)
    .filter((id) => id === userId || friendIds.has(id));
  const where = { userId: { in: open } };
  const [books, bookCount] = await Promise.all([
    prisma.book.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: shelfSize,
      select: {
        id: true,
        title: true,
        author: true,
        cover: true,
        borrowerId: true,
        user: { select: { id: true, firstname: true } },
      },
    }),
    prisma.book.count({ where }),
  ]);
  return {
    id: group.id,
    name: group.name,
    inviteToken: group.inviteToken,
    members: group.members.map(({ joinedAt, user: { _count, ...user } }) => ({
      ...user,
      joinedAt,
      bookCount: _count.books,
      isMe: user.id === userId,
      isFriend: friendIds.has(user.id),
    })),
    books,
    bookCount,
  };
}

// What the join page shows someone holding the link: the group's name,
// who's in it, and a glimpse of their books
export async function getGroupByToken(token: string) {
  const group = await prisma.group.findUnique({
    where: { inviteToken: token },
    select: {
      id: true,
      name: true,
      members: { orderBy: { joinedAt: "asc" }, select: { user: { select: person } } },
    },
  });
  if (!group) return null;
  const ids = group.members.map((member) => member.user.id);
  const [bookCount, recent] = await Promise.all([
    prisma.book.count({ where: { userId: { in: ids } } }),
    prisma.book.findMany({
      where: { userId: { in: ids } },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, title: true, author: true, cover: true },
    }),
  ]);
  return {
    id: group.id,
    name: group.name,
    members: group.members.map((member) => member.user),
    bookCount,
    recent,
  };
}

export type JoinResult =
  | { ok: true; groupId: string }
  | { ok: false; reason: "no-such-group" | "demo-boundary" | "full" };

// Opening a group's link: you're in, friends with everyone in it, any
// request between you is settled, and they each hear you've joined
export async function joinGroup(userId: User["id"], token: string): Promise<JoinResult> {
  const group = await prisma.group.findUnique({
    where: { inviteToken: token },
    select: { id: true, name: true, members: { select: { userId: true } } },
  });
  if (!group) return { ok: false, reason: "no-such-group" };
  const memberIds = group.members.map((member) => member.userId);
  if (memberIds.includes(userId)) return { ok: true, groupId: group.id };
  // Demo sandboxes and real accounts never mix
  if (memberIds.length > 0 && !(await canInteract(userId, memberIds[0]))) {
    return { ok: false, reason: "demo-boundary" };
  }
  if (memberIds.length >= GROUP_MAX_MEMBERS) return { ok: false, reason: "full" };

  await prisma.groupMember.create({ data: { groupId: group.id, userId } });
  const me = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { firstname: true, surname: true, following: { select: { id: true } } },
  });
  const already = new Set(me.following.map((friend) => friend.id));
  for (const memberId of memberIds) {
    if (!already.has(memberId)) await createFriendship(userId, memberId);
  }
  await prisma.notification.updateMany({
    where: {
      type: "FRIEND_REQUEST",
      actionTaken: null,
      OR: [
        { senderId: userId, receiverId: { in: memberIds } },
        { senderId: { in: memberIds }, receiverId: userId },
      ],
    },
    data: { read: true, actionTaken: "accepted" },
  });
  await prisma.$transaction(
    memberIds.map((receiverId) =>
      prisma.notification.create({
        data: {
          type: "GROUP_JOINED",
          senderId: userId,
          receiverId,
          senderName: `${me.firstname} ${me.surname}`.trim(),
          message: group.name,
          groupId: group.id,
        },
      }),
    ),
  );
  return { ok: true, groupId: group.id };
}

// Leaving keeps your friendships. The last one out takes the group with them.
export async function leaveGroup(userId: User["id"], groupId: Group["id"]) {
  await prisma.groupMember.deleteMany({ where: { groupId, userId } });
  if ((await prisma.groupMember.count({ where: { groupId } })) === 0) {
    await prisma.group.deleteMany({ where: { id: groupId } });
  }
}

// Anyone in the group can rename it
export async function renameGroup(userId: User["id"], groupId: Group["id"], name: string) {
  if (!(await isMember(groupId, userId))) return false;
  await prisma.group.update({ where: { id: groupId }, data: { name } });
  return true;
}

// A fresh link, for one that's gone further than it should have. The old
// one stops working.
export async function resetGroupLink(userId: User["id"], groupId: Group["id"]) {
  if (!(await isMember(groupId, userId))) return false;
  await prisma.group.update({ where: { id: groupId }, data: { inviteToken: newToken() } });
  return true;
}
