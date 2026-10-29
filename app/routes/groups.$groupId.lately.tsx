
import { data, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import { FeedPost } from "~/components/friend-activity";
import { loadGroup } from "~/group-page.server";
import { getFriendActivity } from "~/models/activity.server";
import { getUserById } from "~/models/user.server";

// What the people in the group have been up to: the feed, narrowed to
// them, in the same posts with the same things to do

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { userId, group } = await loadGroup(request, params);
  const [activity, user] = await Promise.all([
    getFriendActivity(userId, { among: group.openIds, groups: [group.id], days: 365, limit: 30 }),
    getUserById(userId),
  ]);
  return data({
    activity,
    userId,
    // Whose names open their shelf, as in the feed
    friendIds: user?.following.map((friend) => friend.id) ?? [],
  });
};

export default function GroupLately() {
  const { activity, friendIds, userId } = useLoaderData<typeof loader>();
  if (activity.length === 0) {
    return (
      <p className="py-16 text-center text-stone-500 dark:text-stone-400">
        Nothing yet. Books people add, love or write about show up here.
      </p>
    );
  }
  return (
    // The feed's column
    <ul className="max-w-xl space-y-3">
      {activity.map((item) => (
        <li key={item.id}>
          <FeedPost item={item} friendIds={friendIds} userId={userId} />
        </li>
      ))}
    </ul>
  );
}
