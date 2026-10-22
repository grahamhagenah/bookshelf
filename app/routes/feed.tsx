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
  return json({ userId, activity, friendIds });
};

const DAY = 24 * 60 * 60 * 1000;

// "Today", "Yesterday", the weekday for the last week, then the date
function dayLabel(date: string) {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const day = new Date(date).setHours(0, 0, 0, 0);
  const daysAgo = Math.round((startOfToday - day) / DAY);
  if (daysAgo === 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return new Date(date).toLocaleDateString(undefined, { weekday: "long" });
  return new Date(date).toLocaleDateString(undefined, { month: "long", day: "numeric" });
}

export default function Feed() {
  const { userId, activity, friendIds } = useLoaderData<typeof loader>();

  // Entries grouped under the day they happened
  const days: { label: string; items: typeof activity }[] = [];
  for (const item of activity) {
    const label = dayLabel(item.at);
    const last = days[days.length - 1];
    if (last && last.label === label) last.items.push(item);
    else days.push({ label, items: [item] });
  }

  return (
    <Layout title="Friend activity">
      {activity.length > 0 ? (
        // One block, so the page's section padding applies once; days are
        // set apart by a little space and their heading
        <div>
          {days.map((day, index) => (
          <section key={day.label} aria-label={day.label} className={index > 0 ? "mt-6" : undefined}>
            <h2 className="mb-1 text-sm font-semibold text-stone-500 dark:text-stone-400">
              {day.label}
            </h2>
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {day.items.map((item) => (
                <li key={item.id}>
                  <FriendActivityItem
                    item={item}
                    friendIds={friendIds}
                    userId={userId}
                    layout="full"
                  />
                </li>
              ))}
            </ul>
          </section>
          ))}
        </div>
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
