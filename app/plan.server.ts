import type { User } from "@prisma/client";

import { prisma } from "~/db.server";
import { shelfIds } from "~/models/household.server";
import { FREE_LIMITS } from "~/plan";

// The free plan holds 100 books and 10 friends; Stacks Plus lifts both.
// One subscription covers everyone on a shared shelf, and the demo sandbox
// is never limited.

// Whether this person's shelf is on Plus: theirs, a housemate's, or a demo
export async function hasPlus(userId: User["id"]) {
  const ids = await shelfIds(userId);
  const plus = await prisma.user.count({
    where: { id: { in: ids }, OR: [{ plan: "plus" }, { demoGroup: { not: null } }] },
  });
  return plus > 0;
}

const friendCount = (userId: User["id"]) =>
  prisma.user.count({ where: { followedBy: { some: { id: userId } } } });

// What Settings shows: the plan, how much of each limit is used, and
// where Plus comes from (their own subscription, a gift, or a housemate's)
export async function getPlanUsage(userId: User["id"]) {
  const ids = await shelfIds(userId);
  const [plus, books, friends, members] = await Promise.all([
    hasPlus(userId),
    prisma.book.count({ where: { userId: { in: ids } } }),
    friendCount(userId),
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        firstname: true,
        plan: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        planRenewsAt: true,
        planEndsAt: true,
      },
    }),
  ]);
  const me = members.find((member) => member.id === userId);
  const payer = members.find((member) => member.plan === "plus" && member.id !== userId);
  return {
    plus,
    books,
    friends,
    shared: ids.length > 1,
    limits: FREE_LIMITS,
    // Their own Plus: paid through Stripe, or given by an admin
    own: me?.plan === "plus" ? { paid: Boolean(me.stripeSubscriptionId), pastDue: me.subscriptionStatus === "past_due", renewsAt: me.planRenewsAt, endsAt: me.planEndsAt } : null,
    // Someone on the shared shelf whose Plus covers them
    coveredBy: me?.plan !== "plus" && payer ? payer.firstname : null,
    // A Stripe customer can always reach the portal, even after canceling
    canManage: Boolean(me?.stripeSubscriptionId),
  };
}

// How many more books fit on the shelf: all of them on Plus
export async function roomForBooks(userId: User["id"]) {
  if (await hasPlus(userId)) return Infinity;
  const count = await prisma.book.count({ where: { userId: { in: await shelfIds(userId) } } });
  return Math.max(0, FREE_LIMITS.books - count);
}

// Whether this person can take on another friend
export async function roomForFriend(userId: User["id"]) {
  if (await hasPlus(userId)) return true;
  return (await friendCount(userId)) < FREE_LIMITS.friends;
}

// Why two people can't become friends yet, if they can't: you're at the
// free plan's limit, or they are
export async function friendLimitBetween(userId: User["id"], otherId: User["id"]) {
  if (!(await roomForFriend(userId))) return "full" as const;
  if (!(await roomForFriend(otherId))) return "they-are-full" as const;
  return null;
}
