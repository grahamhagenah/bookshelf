import { prisma } from "~/db.server";
import type { Group, User } from "~/generated/prisma/client";
import { GROUP_DESCRIPTION_MAX, GROUP_NAME_MAX } from "~/group-links";

import { canInteract } from "./demo.server";
import { countPoolBooks } from "./pool.server";

// Groups: a book club, an office, a family. Being in one is enough to see
// everyone's shelf and borrow from them, as friends can, without having to
// friend them all (circle.server says who you can borrow from). Friend
// anyone you like from the group's People tab; leaving keeps those
// friendships, and closes the other members' shelves to you.

export { GROUP_NAME_MAX };
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

// The groups someone is in, with a few faces from each and how many
// books the others have between them
export async function getMyGroups(userId: User["id"]) {
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      members: { orderBy: { joinedAt: "asc" }, select: { user: { select: person } } },
    },
  });
  return Promise.all(
    groups.map(async (group) => ({
      id: group.id,
      name: group.name,
      memberCount: group.members.length,
      memberIds: group.members.map((member) => member.user.id),
      // As the group's page counts them: books, not copies, and not yours
      bookCount: await countPoolBooks(
        group.members.map((member) => member.user.id).filter((id) => id !== userId),
      ),
      faces: group.members.slice(0, 5).map((member) => member.user),
    })),
  );
}

// Your groups as the Groups page shows them, like friends' cards: who's
// in each, by first name with you first, when you joined, and the newest
// books on the others' shelves
export async function getGroupPreviews(userId: User["id"]) {
  const groups = await getMyGroups(userId);
  return Promise.all(
    groups.map(async (group) => {
      const [people, newest, mine] = await Promise.all([
        prisma.user.findMany({
          where: { id: { in: group.memberIds } },
          select: { id: true, firstname: true },
        }),
        prisma.book.findMany({
          where: { userId: { in: group.memberIds.filter((id) => id !== userId) } },
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { id: true, title: true, author: true, cover: true, createdAt: true },
        }),
        prisma.groupMember.findUnique({
          where: { groupId_userId: { groupId: group.id, userId } },
          select: { joinedAt: true },
        }),
      ]);
      const others = group.memberIds
        .filter((id) => id !== userId)
        .map((id) => people.find((someone) => someone.id === id)?.firstname)
        .filter((name): name is string => Boolean(name));
      return { ...group, names: ["You", ...others], newest, joinedAt: mine?.joinedAt ?? null };
    }),
  );
}

// Everything the group's page shows about the people in it, for someone
// in it. Being in it opens everyone's shelf to everyone else, friends or
// not; the ones who aren't your friends keep what they hide off their page
// out of it.
export async function getGroup(groupId: Group["id"], userId: User["id"]) {
  if (!(await isMember(groupId, userId))) return null;
  const [group, me, asked] = await Promise.all([
    prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        name: true,
        inviteToken: true,
        description: true,
        planning: true,
        members: {
          orderBy: { joinedAt: "asc" },
          select: {
            joinedAt: true,
            alertPicks: true,
            alertMeetups: true,
            alertJoins: true,
            user: { select: { ...person, _count: { select: { books: true } } } },
          },
        },
      },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { following: { select: { id: true } } },
    }),
    // Friend requests you've sent that are still waiting
    prisma.notification.findMany({
      where: { type: "FRIEND_REQUEST", senderId: userId, actionTaken: null },
      select: { receiverId: true },
    }),
  ]);
  if (!group) return null;
  const friendIds = new Set(me.following.map((friend) => friend.id));
  const requested = new Set(asked.map((request) => request.receiverId));
  // Whoever's been in longest runs it: the person who started it, until
  // they leave
  const ownerId = group.members[0]?.user.id;
  const mine = group.members.find((member) => member.user.id === userId);
  const members = group.members.map(({ joinedAt, user: { _count, ...user } }) => ({
    ...user,
    joinedAt,
    bookCount: _count.books,
    isMe: user.id === userId,
    isFriend: friendIds.has(user.id),
    // You've asked to be friends and they haven't answered yet
    requested: requested.has(user.id),
    isOwner: user.id === ownerId,
  }));
  // Your own books are in the group too, but you don't come here for them
  const openIds = members.filter((member) => !member.isMe).map((member) => member.id);
  const groupOnly = members
    .filter((member) => !member.isMe && !member.isFriend)
    .map((member) => member.id);
  return {
    id: group.id,
    name: group.name,
    inviteToken: group.inviteToken,
    description: group.description,
    planning: group.planning,
    // Which of its goings-on reach your alerts
    myAlerts: {
      picks: mine?.alertPicks ?? true,
      meetups: mine?.alertMeetups ?? true,
      joins: mine?.alertJoins ?? true,
    },
    members,
    openIds,
    groupOnly,
    myBookCount: members.find((member) => member.isMe)?.bookCount ?? 0,
    // Books, not copies: five people's Dune is one
    bookCount: await countPoolBooks(openIds, groupOnly),
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
      description: true,
      members: { orderBy: { joinedAt: "asc" }, select: { user: { select: person } } },
    },
  });
  if (!group) return null;
  const ids = group.members.map((member) => member.user.id);
  // Not what they keep off their page: whoever holds the link isn't in yet
  const [bookCount, recent] = await Promise.all([
    prisma.book.count({ where: { userId: { in: ids }, hiddenFromPage: false } }),
    prisma.book.findMany({
      where: { userId: { in: ids }, hiddenFromPage: false },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, title: true, author: true, cover: true },
    }),
  ]);
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    members: group.members.map((member) => member.user),
    bookCount,
    recent,
  };
}

export type JoinResult =
  | { ok: true; groupId: string }
  | { ok: false; reason: "no-such-group" | "demo-boundary" | "full" };

// Opening a group's link: you're in, everyone's shelves open to you and
// yours to them, and they each hear you've joined
export async function joinGroup(userId: User["id"], token: string): Promise<JoinResult> {
  const group = await prisma.group.findUnique({
    where: { inviteToken: token },
    select: { id: true, name: true, members: { select: { userId: true, alertJoins: true } } },
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
    select: { firstname: true, surname: true },
  });
  // Only to the members who want to hear about joins
  const listening = group.members.filter((member) => member.alertJoins).map((member) => member.userId);
  await prisma.$transaction(
    listening.map((receiverId) =>
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
    await removeGroups([groupId]);
  }
}

// Groups gone for good, with the "joined" notices that pointed at them,
// so no notification leads to a missing page. Friendships stay.
export async function removeGroups(groupIds: Group["id"][]) {
  if (groupIds.length === 0) return;
  await prisma.notification.deleteMany({ where: { groupId: { in: groupIds } } });
  await prisma.group.deleteMany({ where: { id: { in: groupIds } } });
}

// Whoever runs the group can end it for everyone
export async function deleteGroup(userId: User["id"], groupId: Group["id"]) {
  if (!(await runsGroup(userId, groupId))) return false;
  await removeGroups([groupId]);
  return true;
}

// Whoever's been in the group longest
async function runsGroup(userId: User["id"], groupId: Group["id"]) {
  const first = await prisma.groupMember.findFirst({
    where: { groupId },
    orderBy: { joinedAt: "asc" },
    select: { userId: true },
  });
  return first?.userId === userId;
}

// The person who runs the group can take someone out of it. Like leaving,
// it keeps their friendships; it only stops them seeing the group.
export async function removeFromGroup(userId: User["id"], groupId: Group["id"], memberId: User["id"]) {
  if (userId === memberId || !(await runsGroup(userId, groupId))) return false;
  await prisma.groupMember.deleteMany({ where: { groupId, userId: memberId } });
  return true;
}

// Anyone in the group can rename it
export async function renameGroup(userId: User["id"], groupId: Group["id"], name: string) {
  if (!(await isMember(groupId, userId))) return false;
  await prisma.group.update({ where: { id: groupId }, data: { name } });
  return true;
}

// A few lines on what the group is; anyone in it can write them, as they
// can rename it. Empty takes it away
export async function describeGroup(userId: User["id"], groupId: Group["id"], description: string) {
  if (!(await isMember(groupId, userId))) return false;
  const text = description.trim().slice(0, GROUP_DESCRIPTION_MAX);
  await prisma.group.update({ where: { id: groupId }, data: { description: text || null } });
  return true;
}

// The planning card on or off, for the whole group, so it's for whoever
// runs it to say
export async function setGroupPlanning(userId: User["id"], groupId: Group["id"], on: boolean) {
  if (!(await runsGroup(userId, groupId))) return false;
  await prisma.group.update({ where: { id: groupId }, data: { planning: on } });
  return true;
}

export interface GroupAlerts {
  picks: boolean;
  meetups: boolean;
  joins: boolean;
}

// Which of the group's goings-on reach your alerts: yours alone to say
export async function setGroupAlerts(userId: User["id"], groupId: Group["id"], alerts: GroupAlerts) {
  if (!(await isMember(groupId, userId))) return false;
  await prisma.groupMember.update({
    where: { groupId_userId: { groupId, userId } },
    data: { alertPicks: alerts.picks, alertMeetups: alerts.meetups, alertJoins: alerts.joins },
  });
  return true;
}

// A fresh link, for one that's gone further than it should have. The old
// one stops working.
export async function resetGroupLink(userId: User["id"], groupId: Group["id"]) {
  if (!(await isMember(groupId, userId))) return false;
  await prisma.group.update({ where: { id: groupId }, data: { inviteToken: newToken() } });
  return true;
}
