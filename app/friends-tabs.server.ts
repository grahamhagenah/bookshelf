import { prisma } from "~/db.server";
import type { User } from "~/generated/prisma/client";
import { circleOf } from "~/models/circle.server";
import { shelfIds } from "~/models/household.server";
import { countPoolBooks } from "~/models/pool.server";

// The numbers on the Friends page's tabs: friends, the books they have
// between them, and your groups
export async function getFriendsTabCounts(userId: User["id"]) {
  const [circle, mine, groups] = await Promise.all([
    circleOf(userId),
    shelfIds(userId),
    prisma.groupMember.count({ where: { userId } }),
  ]);
  return {
    friends: circle.friends.size,
    // Friends' books and group-mates'; anyone you share a shelf with is on
    // My shelf already
    books: await countPoolBooks(
      circle.ids.filter((id) => !mine.includes(id)),
      [...circle.groupOnly],
    ),
    groups,
  };
}
