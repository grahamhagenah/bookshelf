import { prisma } from "~/db.server";
import type { Prisma, User } from "~/generated/prisma/client";

import { shelfIdsFor } from "./household.server";

// Whose shelves you can see and borrow from: your friends, and the people
// you're in a group with. Being in a group is enough; nobody has to friend
// everyone in their book club. Someone you know only through a group sees
// your shelf without the books you keep off your page, and the other way
// around.

export interface Circle {
  // Friends, and the people in your groups who aren't friends too
  friends: Set<User["id"]>;
  groupOnly: Set<User["id"]>;
  // Everyone in it, friends first
  ids: User["id"][];
}

export async function circleOf(userId: User["id"]): Promise<Circle> {
  const [me, mates] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { following: { select: { id: true } } },
    }),
    prisma.groupMember.findMany({
      where: { userId: { not: userId }, group: { members: { some: { userId } } } },
      select: { userId: true },
    }),
  ]);
  const friends = new Set(me?.following.map((friend) => friend.id) ?? []);
  const groupOnly = new Set(
    mates.map((mate) => mate.userId).filter((id) => !friends.has(id)),
  );
  return { friends, groupOnly, ids: [...friends, ...groupOnly] };
}

// The books in your circle, as a where clause: all of a friend's shelf
// (and their household's), a group-mate's without what they keep off their
// page. Pass `only` to narrow it to some of the circle.
export async function circleBooks(
  circle: Circle,
  only?: User["id"][],
): Promise<Prisma.BookWhereInput> {
  const keep = (ids: Iterable<User["id"]>) =>
    [...ids].filter((id) => !only || only.includes(id));
  const [friendShelves, groupShelves] = await Promise.all([
    shelfIdsFor(keep(circle.friends)),
    shelfIdsFor(keep(circle.groupOnly)),
  ]);
  return {
    OR: [
      { userId: { in: friendShelves } },
      { userId: { in: groupShelves.filter((id) => !friendShelves.includes(id)) }, hiddenFromPage: false },
    ],
  };
}

// Whether you can see (and ask for) this one copy: your circle's, and not
// one a group-mate keeps off their page
export async function inCircle(
  userId: User["id"],
  book: { userId: User["id"]; hiddenFromPage: boolean },
) {
  const circle = await circleOf(userId);
  const [friendShelves, groupShelves] = await Promise.all([
    shelfIdsFor([...circle.friends]),
    shelfIdsFor([...circle.groupOnly]),
  ]);
  if (friendShelves.includes(book.userId)) return true;
  return groupShelves.includes(book.userId) && !book.hiddenFromPage;
}
