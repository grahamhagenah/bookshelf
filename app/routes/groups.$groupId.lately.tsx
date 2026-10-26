
import { data, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import FriendActivityItem from "~/components/friend-activity";
import { loadGroup } from "~/group-page.server";
import { getFriendActivity } from "~/models/activity.server";

// What the people in the group have been up to, as the feed shows it

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { userId, group } = await loadGroup(request, params);
  return data({
    activity: await getFriendActivity(userId, { among: group.openIds, days: 365, limit: 30 }),
    friendIds: group.openIds,
  });
};

export default function GroupLately() {
  const { activity, friendIds } = useLoaderData<typeof loader>();
  if (activity.length === 0) {
    return (
      <p className="py-16 text-center text-stone-500 dark:text-stone-400">
        Nothing yet. Books people add, love or write about show up here.
      </p>
    );
  }
  return (
    <ul className="max-w-2xl divide-y divide-stone-100 dark:divide-stone-800">
      {activity.map((item) => (
        <li key={item.id}>
          <FriendActivityItem item={item} friendIds={friendIds} />
        </li>
      ))}
    </ul>
  );
}
