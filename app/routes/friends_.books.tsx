
import { data, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

import EmptyList from "~/components/empty-list";
import FriendsTabs from "~/components/friends-tabs";
import { BookIcon } from "~/components/icons";
import PooledShelf from "~/components/pooled-shelf";
import { prisma } from "~/db.server";
import { getFriendsTabCounts } from "~/friends-tabs.server";
import { circleOf } from "~/models/circle.server";
import { getMyGroups } from "~/models/group.server";
import { shelfIds } from "~/models/household.server";
import { loadPooledShelf } from "~/pooled-shelf.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";

// Every friend's books as one shelf, to browse rather than search for:
// one entry per book with whoever has it, and the ones you want first.
// The menu narrows it to one person or one of your groups; a group's
// page sends you here for its books.

export const meta: MetaFunction = () => seo({ title: "Friends' books", noindex: true });

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const [mine, groups, counts] = await Promise.all([
    shelfIds(userId),
    getMyGroups(userId),
    getFriendsTabCounts(userId),
  ]);
  // Your friends, and the people in your groups, less anyone you share a
  // shelf with: they're on My shelf already
  const circle = await circleOf(userId);
  const openIds = circle.ids.filter((id) => !mine.includes(id));
  const people = await prisma.user.findMany({
    where: { id: { in: openIds } },
    select: { id: true, firstname: true, surname: true },
    orderBy: { firstname: "asc" },
  });
  const shelf = await loadPooledShelf(request, userId, openIds, {
    lenders: people,
    groups,
    groupOnly: [...circle.groupOnly],
  });
  return data({ shelf, counts });
};

export default function FriendsBooks() {
  const { shelf, counts } = useLoaderData<typeof loader>();
  return (
    <main className="mt-8 md:mt-10 px-4 md:px-8 pb-8">
      <h1 className="sr-only">Friends&apos; books</h1>
      <FriendsTabs counts={counts} />
      <PooledShelf
        data={shelf}
        empty={
          <EmptyList
            icon={<BookIcon size={28} />}
            title={counts.friends === 0 ? "No friends yet" : "No books on their shelves yet"}
            action={
              counts.friends === 0
                ? { to: "/friends/add", label: "Add friends", plus: true }
                : undefined
            }
            className="mt-2"
          >
            {counts.friends === 0
              ? "Once you have friends on Stacks, everything on their shelves shows up here to browse."
              : "As your friends add books, they show up here."}
          </EmptyList>
        }
      />
    </main>
  );
}
