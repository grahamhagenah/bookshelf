import { prisma } from "~/db.server";
import type { User } from "~/generated/prisma/client";
import { shelfIds } from "~/models/household.server";
import { countPoolBooks } from "~/models/pool.server";

// The numbers on the Friends page's tabs: friends, the books they have
// between them, and your groups
export async function getFriendsTabCounts(userId: User["id"]) {
  const [me, mine, groups] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { following: { select: { id: true } } } }),
    shelfIds(userId),
    prisma.groupMember.count({ where: { userId } }),
  ]);
  const friendIds = me?.following.map((friend) => friend.id) ?? [];
  return {
    friends: friendIds.length,
    // Anyone you share a shelf with is on My shelf already
    books: await countPoolBooks(friendIds.filter((id) => !mine.includes(id))),
    groups,
  };
}
