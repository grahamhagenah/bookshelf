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
import { getWantToRead } from "~/models/wish.server";
import { publicOrigin } from "~/origin.server";
import { ABOUT_STACKS, seo, structuredData } from "~/seo";
import { getUserId, requireUserId } from "~/session.server";
import { WELCOME_COOKIE, dismissCookie, welcomeDismissed } from "~/share-prompt.server";

export const meta: MetaFunction<typeof loader> = ({ data }) =>
  data?.home
    ? seo({ title: "Home", noindex: true })
    : [...seo({ path: "/" }), structuredData(ABOUT_STACKS)];

// Signed in, this is your home: your books and friends' activity.
// Signed out, it's the landing page.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await getUserId(request);
  const user = userId ? await getUserById(userId) : null;
  if (!user) {
    // Just deleted their account from Settings
    return json({ home: null, deleted: new URL(request.url).searchParams.has("deleted") });
  }

  const [books, activity, sentRequests, wanted] = await Promise.all([
    getHomeBooks(user.id, await shelfIds(user.id)),
    getFriendActivity(user.id, { limit: 6 }),
    getPendingFriendRequests(user.id),
    getWantToRead(user.id),
  ]);
  return json({
    home: {
      books,
      activity,
      // The want-to-read list, ones a friend has first
      wanted: [...wanted]
        .sort((a, b) => Number(b.copies.length > 0) - Number(a.copies.length > 0))
        .map(({ id, title, author, cover, copies }) => {
          // A friend's copy opens, one that's on their shelf if there is;
          // with none, a search for it
          const copy = copies.find((each) => each.available) ?? copies[0];
          return {
            id,
            title,
            author,
            cover,
            owner: copy?.owner.firstname ?? null,
            to: copy ? `/books/${copy.bookId}` : `/search?q=${encodeURIComponent(title)}`,
          };
        }),
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
  const data = useLoaderData<typeof loader>();
  if (data.home) return <Home {...data.home} />;
  return (
    <>
      {"deleted" in data && data.deleted ? (
        <p role="status" className="mx-4 mt-6 rounded-lg bg-stone-100 dark:bg-stone-900 px-4 py-3 text-center text-sm text-stone-700 dark:text-stone-200 md:mx-8">
          Your account and everything in it has been deleted. Thanks for being part of Stacks.
        </p>
      ) : null}
      <Landing />
    </>
  );
}
