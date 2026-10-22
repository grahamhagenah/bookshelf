import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import Home from "~/components/home";
import Landing from "~/components/landing";
import { getFriendActivity } from "~/models/activity.server";
import { getHomeBooks } from "~/models/book.server";
import { shelfIds } from "~/models/household.server";
import { getPendingFriendRequests, getUserById } from "~/models/user.server";
import { publicOrigin } from "~/origin.server";
import { seo } from "~/seo";
import { getUserId, requireUserId } from "~/session.server";
import { WELCOME_COOKIE, dismissCookie, welcomeDismissed } from "~/share-prompt.server";

export const meta: MetaFunction<typeof loader> = ({ data }) =>
  data?.home ? seo({ title: "Home", noindex: true }) : seo({ path: "/" });

// Signed in, this is your home: your books and friends' activity.
// Signed out, it's the landing page.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await getUserId(request);
  const user = userId ? await getUserById(userId) : null;
  if (!user) return json({ home: null });

  const [books, activity, sentRequests] = await Promise.all([
    getHomeBooks(user.id, await shelfIds(user.id)),
    getFriendActivity(user.id, { limit: 6 }),
    getPendingFriendRequests(user.id),
  ]);
  return json({
    home: {
      books,
      activity,
      friendIds: user.following.map((friend) => friend.id),
      requestsSent: sentRequests.length,
      welcomeDismissed: welcomeDismissed(request),
      // For the "Share your shelf" step on a new account's welcome
      shareUrl: user.shareToken
        ? `${publicOrigin(request)}/share/${user.shareToken}`
        : null,
    },
  });
};

// "Skip for now" on the welcome steps
export const action = async ({ request }: ActionFunctionArgs) => {
  await requireUserId(request);
  return json(
    { dismissed: true },
    { headers: { "Set-Cookie": dismissCookie(WELCOME_COOKIE) } },
  );
};

export default function Index() {
  const { home } = useLoaderData<typeof loader>();
  if (home) return <Home {...home} />;
  return <Landing />;
}
