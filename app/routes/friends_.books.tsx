import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import FriendsTabs from "~/components/friends-tabs";
import PooledShelf from "~/components/pooled-shelf";
import { shelfIds } from "~/models/household.server";
import { countPoolBooks } from "~/models/pool.server";
import { getUserById } from "~/models/user.server";
import { loadPooledShelf } from "~/pooled-shelf.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";

// Every friend's books as one shelf, to browse rather than search for:
// one entry per book with whoever has it, and the ones you want first

export const meta: MetaFunction = () => seo({ title: "Friends' books", noindex: true });

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const [user, mine] = await Promise.all([getUserById(userId), shelfIds(userId)]);
  // Anyone you share a shelf with is on My shelf already
  const friends = (user?.following ?? []).filter((friend) => !mine.includes(friend.id));
  const openIds = friends.map((friend) => friend.id);
  const [shelf, bookCount] = await Promise.all([
    loadPooledShelf(request, userId, openIds, friends),
    countPoolBooks(openIds),
  ]);
  return json({ shelf, counts: { friends: friends.length, books: bookCount } });
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
          <>
            <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
              {counts.friends === 0 ? "No friends yet" : "No books on their shelves yet"}
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-stone-500 dark:text-stone-400">
              {counts.friends === 0
                ? "Once you have friends on Stacks, everything on their shelves shows up here to browse."
                : "As your friends add books, they show up here."}
            </p>
            {counts.friends === 0 ? (
              <Link
                to="/friends#find"
                className="mt-5 inline-flex h-9 items-center rounded-md bg-forest-600 px-4 text-sm font-medium text-white hover:bg-forest-700 transition-colors"
              >
                Find friends
              </Link>
            ) : null}
          </>
        }
      />
    </main>
  );
}
