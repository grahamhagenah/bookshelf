import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireUserId } from "~/session.server";
import { getUserById, searchUsers } from "~/models/user.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);

  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";

  if (query.length < 2) {
    return json([]);
  }

  const results = await searchUsers(query, userId);

  // Get IDs of users already being followed
  const followingIds = new Set(user?.following.map((f) => f.id) || []);

  // Get IDs of users with pending friend requests from current user
  const pendingRequestIds = new Set(
    user?.notificationsSent
      ?.filter((n) => n.type === "FRIEND_REQUEST")
      .map((n) => n.receiverId) || []
  );

  // Filter out users already followed or with pending requests
  const filteredResults = results.filter(
    (u) => !followingIds.has(u.id) && !pendingRequestIds.has(u.id)
  );

  return json(filteredResults);
};
