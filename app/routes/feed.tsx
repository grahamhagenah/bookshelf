import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import FriendActivityItem from "~/components/friend-activity";
import Layout from "~/components / Layout/Layout";
import { getFriendActivity } from "~/models/activity.server";
import { getUserById } from "~/models/user.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";

// What friends have been adding, loving and writing about lately

export const meta: MetaFunction = () =>
  seo({ title: "Friend activity", noindex: true });

export const handle = {
  breadcrumb: () => <span>Friend activity</span>,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const [user, activity] = await Promise.all([
    getUserById(userId),
    getFriendActivity(userId, { days: 90, limit: 50 }),
  ]);
  const friendIds = user?.following.map((friend) => friend.id) ?? [];
  return json({ activity, friendIds });
};

export default function Feed() {
  const { activity, friendIds } = useLoaderData<typeof loader>();

  return (
    <Layout title="Friend activity">
      {activity.length > 0 ? (
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {activity.map((item) => (
            <li key={item.id}>
              <FriendActivityItem item={item} friendIds={friendIds} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-16 text-center text-stone-500 dark:text-stone-400">
          {friendIds.length === 0 ? (
            <>
              <p>Add friends to see the books they add and love.</p>
              <Link
                to="/friends"
                className="mt-2 inline-block text-stone-700 dark:text-stone-200 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-900 dark:hover:text-stone-100"
              >
                Find friends
              </Link>
            </>
          ) : (
            <p>Nothing new from your friends lately.</p>
          )}
        </div>
      )}
    </Layout>
  );
}
