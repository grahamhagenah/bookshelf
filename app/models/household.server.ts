import crypto from "node:crypto";

import type { User } from "@prisma/client";

import { prisma } from "~/db.server";

// A household is people who share one shelf: a couple, a family, a flat.
// Each person keeps their own login, notes, hearts, want-to-read list and
// friends; what they share is the books. A book still records who added
// it, but everyone in the household can lend, edit and return it.

const member = {
  select: { id: true, firstname: true, surname: true, profileEmoji: true, demoGroup: true },
} as const;

export async function getHousehold(userId: User["id"]) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      household: {
        select: { id: true, inviteToken: true, members: { ...member, orderBy: { createdAt: "asc" } } },
      },
    },
  });
  return user?.household ?? null;
}

// Everyone whose books count as this person's: themselves and their
// household, if any
export async function shelfIds(userId: User["id"]): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { household: { select: { members: { select: { id: true } } } } },
  });
  const ids = user?.household?.members.map((m) => m.id) ?? [];
  return ids.includes(userId) ? ids : [userId, ...ids];
}

// The same for several people at once (friends and their households)
export async function shelfIdsFor(userIds: User["id"][]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, household: { select: { members: { select: { id: true } } } } },
  });
  const ids = new Set(userIds);
  for (const user of users) {
    for (const m of user.household?.members ?? []) ids.add(m.id);
  }
  return [...ids];
}

// Makes an invite link for this person's household, creating the
// household first if they're not in one. The same token is handed out
// until it's revoked.
export async function createHouseholdInvite(userId: User["id"]) {
  const existing = await getHousehold(userId);
  if (existing?.inviteToken) return existing.inviteToken;
  const inviteToken = crypto.randomBytes(12).toString("base64url");
  if (existing) {
    await prisma.household.update({ where: { id: existing.id }, data: { inviteToken } });
  } else {
    await prisma.household.create({
      data: { inviteToken, members: { connect: { id: userId } } },
    });
  }
  return inviteToken;
}

export async function revokeHouseholdInvite(userId: User["id"]) {
  const household = await getHousehold(userId);
  if (household) {
    await prisma.household.update({ where: { id: household.id }, data: { inviteToken: null } });
  }
}

export function getHouseholdByInvite(inviteToken: string) {
  return prisma.household.findUnique({
    where: { inviteToken },
    select: { id: true, members: member },
  });
}

export type JoinResult =
  | { ok: true; members: string[] }
  | { ok: false; reason: "no-such-invite" | "already-in-one" | "demo-boundary" };

// Joins the household behind an invite. Someone already sharing a shelf
// with others has to leave that first.
export async function joinHousehold(userId: User["id"], inviteToken: string): Promise<JoinResult> {
  const [household, user] = await Promise.all([
    getHouseholdByInvite(inviteToken),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        demoGroup: true,
        household: { select: { id: true, members: { select: { id: true } } } },
      },
    }),
  ]);
  if (!household || !user) return { ok: false, reason: "no-such-invite" };
  if (household.members.some((m) => m.id === userId)) {
    return { ok: true, members: household.members.map((m) => m.firstname) };
  }
  // Demo sandboxes and real accounts never mix
  if (household.members.some((m) => m.demoGroup !== user.demoGroup)) {
    return { ok: false, reason: "demo-boundary" };
  }
  if (user.household && user.household.members.length > 1) {
    return { ok: false, reason: "already-in-one" };
  }

  await prisma.user.update({ where: { id: userId }, data: { householdId: household.id } });
  // A household they were alone in is no use to anyone now
  if (user.household) {
    await prisma.household.delete({ where: { id: user.household.id } });
  }
  return { ok: true, members: household.members.map((m) => m.firstname) };
}

// Their own books go with them; the others keep the shelf
export async function leaveHousehold(userId: User["id"]) {
  const household = await getHousehold(userId);
  if (!household) return;
  await prisma.user.update({ where: { id: userId }, data: { householdId: null } });
  if (household.members.length <= 1) {
    await prisma.household.delete({ where: { id: household.id } });
  }
}
