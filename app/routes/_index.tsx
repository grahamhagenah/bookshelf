
import { data, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

import Home, { POPULAR_SHOWN, POSTS_SHOWN } from "~/components/home";
import Landing from "~/components/landing";
import { getFriendActivity } from "~/models/activity.server";
import { getHomeBooks } from "~/models/book.server";
import { getFriendInvite } from "~/models/friend.server";
import { getMyGroups } from "~/models/group.server";
import { getMyHolds } from "~/models/hold.server";
import { shelfIds } from "~/models/household.server";
import { nameList } from "~/models/name-list.server";
import { countPoolBooks } from "~/models/pool.server";
import { getPopularWithFriends } from "~/models/popular.server";
import { getPendingFriendRequests, getUserById } from "~/models/user.server";
import { getWantToRead } from "~/models/wish.server";
import { publicOrigin } from "~/origin.server";
import { pageUrl } from "~/page-url";
import { ABOUT_STACKS, seo, structuredData } from "~/seo";
import { getUserId, requireUserId } from "~/session.server";
import {
  WELCOME_COOKIE,
  dismissCookie,
  welcomeDismissed,
} from "~/share-prompt.server";
import { workPath } from "~/utils";

export const meta: MetaFunction<typeof loader> = ({ loaderData }) =>
  loaderData?.home
    ? seo({ title: "Home", noindex: true })
    : [...seo({ path: "/" }), structuredData(ABOUT_STACKS)];

// Signed in, this is your home: your books and friends' activity.
// Signed out, it's the landing page.
// "Maya has it", "Maya and Sam have it", "Maya and 2 others have it"
function haveIt(names: string[]) {
  if (names.length === 0) return null;
  if (names.length === 1) return `${names[0]} has it`;
  if (names.length === 2) return `${names[0]} and ${names[1]} have it`;
  return `${names[0]} and ${names.length - 1} others have it`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await getUserId(request);
  const user = userId ? await getUserById(userId) : null;
  if (!user) {
    // Just deleted their account from Settings
    return data({
      home: null,
      deleted: pageUrl(request).searchParams.has("deleted"),
    });
  }

  const friendIds = user.following.map((friend) => friend.id);
  const shelf = await shelfIds(user.id);
  const [
    books,
    activity,
    sentRequests,
    wanted,
    invite,
    popular,
    friendBookCount,
    groups,
    waiting,
    names,
  ] = await Promise.all([
    getHomeBooks(user.id, shelf),
    // The latest few, as many as the loans beside them
    getFriendActivity(user.id, { limit: POSTS_SHOWN }),
    getPendingFriendRequests(user.id),
    getWantToRead(user.id),
    getFriendInvite(user.id),
    getPopularWithFriends(user.id, POPULAR_SHOWN),
    // For a new account with no books of its own: what friends have
    countPoolBooks(friendIds),
    getMyGroups(user.id),
    // Books you're in line for
    getMyHolds(user.id),
    // People lent to by name, who count as people to lend to
    nameList(user.id),
  ]);
  return data({
    home: {
      books,
      activity,
      // The want-to-read list, ones a friend has first
      wanted: [...wanted]
        .sort(
          (a, b) => Number(b.copies.length > 0) - Number(a.copies.length > 0),
        )
        .map(({ id, title, author, cover, copies, openLibraryKey }) => {
          // Friends with a copy on their shelf come first
          const sorted = [...copies].sort(
            (a, b) => Number(b.available) - Number(a.available),
          );
          const owners = [
            ...new Set(sorted.map((copy) => copy.owner.firstname)),
          ];
          const available = sorted.filter((copy) => copy.available);
          // Where the cover goes: a friend's one copy (on a shelf if there
          // is) when that's the only choice; else the book's own page, which
          // lists friends' copies too. One that came without an Open
          // Library key gets it found on the way.
          const to =
            sorted[0] && available.length <= 1
              ? `/books/${sorted[0].bookId}`
              : (workPath(openLibraryKey) ?? `/want-to-read/${id}`);
          return { id, title, author, cover, owners: haveIt(owners), to };
        }),
      // The books passed around most among friends, new to you
      popular: popular.map(({ owners, ...book }) => ({
        ...book,
        owners: haveIt(owners),
      })),
      friendIds,
      friendBookCount,
      requestsSent: sentRequests.length,
      welcomeDismissed: welcomeDismissed(request),
      // For the "Invite friends" step on a new account's welcome
      inviteUrl: `${publicOrigin(request)}/invite/${invite}`,
      // Sharing a shelf with someone at home already, so it isn't offered
      sharesShelf: shelf.length > 1,
      groups: groups.map(({ id, name, memberCount, faces }) => ({
        id,
        name,
        memberCount,
        faces,
      })),
      waiting,
      nameCount: names.length,
    },
  });
};

// "Skip for now" on the welcome steps
export const action = async ({ request }: ActionFunctionArgs) => {
  await requireUserId(request);
  return data(
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
        <p
          role="status"
          className="mx-4 mt-6 rounded-lg bg-stone-100 dark:bg-stone-900 px-4 py-3 text-center text-sm text-stone-700 dark:text-stone-200 md:mx-8"
        >
          Your account and everything in it has been deleted. Thanks for being
          part of Stacks.
        </p>
      ) : null}
      <Landing />
    </>
  );
}
