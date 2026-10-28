
import { data, Link, useFetcher, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

import Avatar from "~/components/avatar";
import BookCover from "~/components/book-cover";
import Faces from "~/components/faces";
import FriendsTabs from "~/components/friends-tabs";
import {
  BookIcon,
  BookmarkIcon,
  BorrowedIcon,
  ClockIcon,
  CommonIcon,
  FeedIcon,
  LentIcon,
} from "~/components/icons";
import Layout from "~/components/layout";
import { RailGroups } from "~/components/side-rail";
import { primaryButton, quietButton, sectionHeading } from "~/components/ui";
import { getFriendsTabCounts } from "~/friends-tabs.server";
import { groupPath } from "~/group-links";
import {
  answerFriendRequest,
  getFriendCards,
  getIncomingFriendRequests,
  removeFriend,
  setHiddenFromFeed,
} from "~/models/friend.server";
import { getMyGroups } from "~/models/group.server";
import { getPendingFriendRequests } from "~/models/user.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";
import { agoInWords, type LoaderData } from "~/utils";

export const meta: MetaFunction = () =>
  seo({ title: "Friends", noindex: true });

export const handle = {
  breadcrumb: () => <Link to="/friends">Friends</Link>,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const [friends, incoming, pendingRequests, groups] = await Promise.all([
    getFriendCards(userId),
    getIncomingFriendRequests(userId),
    getPendingFriendRequests(userId),
    getMyGroups(userId),
  ]);
  return data({
    // For the tabs across the top
    counts: await getFriendsTabCounts(userId),
    friends,
    incoming,
    pendingRequests,
    // A way straight to each group, without the Groups tab in between
    groups,
  });
};

interface ActionData {
  errors: null;
  success: boolean;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const friendId = formData.get("friendId");

  if ((intent === "hide" || intent === "show") && typeof friendId === "string") {
    await setHiddenFromFeed(userId, friendId, intent === "hide");
    return data<ActionData>({ errors: null, success: true });
  }

  if (intent === "remove" && typeof friendId === "string") {
    await removeFriend(userId, friendId);
    return data<ActionData>({ errors: null, success: true });
  }

  const notificationId = formData.get("notificationId");
  if ((intent === "accept" || intent === "decline") && typeof notificationId === "string") {
    await answerFriendRequest(userId, notificationId, intent === "accept");
    return data<ActionData>({ errors: null, success: true });
  }

  return data<ActionData>({ errors: null, success: false }, { status: 400 });
};

type Friend = LoaderData<typeof loader>["friends"][number];

function monthYear(date: string | Date) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export default function Friends() {
  const data = useLoaderData<typeof loader>();
  const { friends, incoming, pendingRequests } = data;

  return (
    <Layout
      title="Friends"
      // Beside your friends on wide screens, kept in view while they scroll
      // past: your groups first, then requests to answer and the ones
      // you're waiting on
      aside={
        <aside className="hidden space-y-10 self-start lg:sticky lg:top-24 lg:block">
          <RailGroups groups={data.groups} limit={10} />
          {data.incoming.length > 0 ? (
            <section aria-labelledby="rail-requests">
              <h2 id="rail-requests" className={`${sectionHeading} mb-3`}>
                Friend requests
                <span className="ml-1.5 text-sm font-normal text-stone-400 dark:text-stone-500">
                  {data.incoming.length}
                </span>
              </h2>
              <ul className="space-y-3">
                {data.incoming.map((request) => (
                  <IncomingRequest key={request.id} request={request} compact />
                ))}
              </ul>
            </section>
          ) : null}
          {data.pendingRequests.length > 0 ? (
            <section aria-labelledby="rail-waiting">
              <h2 id="rail-waiting" className={`${sectionHeading} mb-3`}>
                Waiting to hear back
                <span className="ml-1.5 text-sm font-normal text-stone-400 dark:text-stone-500">
                  {data.pendingRequests.length}
                </span>
              </h2>
              <ul className="space-y-3">
                {data.pendingRequests.map((request) => (
                  <li key={request.id} className="flex items-center gap-3">
                    <Avatar
                      firstname={request.receiver.firstname}
                      surname={request.receiver.surname}
                      size="sm"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                        {request.receiver.firstname} {request.receiver.surname}
                      </span>
                      <span className="block text-xs text-stone-500 dark:text-stone-400">
                        Asked {agoInWords(request.createdAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      }
      header={
        <>
          <FriendsTabs counts={data.counts} />
          {/* On phones, where there's no room beside them: straight to each
              of your groups, without the Groups tab between */}
          {data.groups.length > 0 ? (
            <nav aria-label="Your groups" className="-mt-1 mb-8 flex flex-wrap items-center gap-2 lg:hidden">
              {data.groups.map((group) => (
                <Link
                  key={group.id}
                  to={groupPath(group)}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-stone-200 dark:border-stone-800 py-1 pl-1 pr-4 text-sm font-medium text-stone-800 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-600 transition-colors"
                >
                  <Faces people={group.faces} max={3} />
                  {group.name}
                </Link>
              ))}
            </nav>
          ) : null}
        </>
      }
    >

      <section>
        {/* On phones, above your friends; wider screens have them at the
            top of the side column */}
        {incoming.length > 0 ? (
          <div className="mb-8 border-b border-stone-100 pb-8 dark:border-stone-800 lg:hidden">
            <h2 className="text-lg font-semibold">Friend requests</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {incoming.map((request) => (
                <IncomingRequest key={request.id} request={request} />
              ))}
            </ul>
          </div>
        ) : null}
        {/* The tab above already says how many */}
        <h2 className="sr-only">Your friends</h2>

        {friends.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {friends.map((friend) => (
              <FriendCard key={friend.id} friend={friend} />
            ))}
          </ul>
        ) : (
          <div className="rounded-xl border border-dashed border-stone-300 dark:border-stone-700 px-6 py-10 text-center">
            <p className="font-medium text-stone-900 dark:text-stone-100">No friends yet</p>
            <p className="mt-1 text-stone-500 dark:text-stone-400">
              Stacks is better with people to borrow from.
            </p>
            <Link
              to="/friends/add"
              className="mt-4 inline-flex h-9 items-center rounded-md bg-forest-600 px-4 text-sm font-medium text-white hover:bg-forest-700 transition-colors"
            >
              Add friends
            </Link>
          </div>
        )}

        {/* On phones; wider screens have it in the side column */}
        {pendingRequests.length > 0 ? (
          <div className="mt-8 lg:hidden">
            <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400">
              Waiting to hear back
            </h3>
            <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-2">
              {pendingRequests.map((request) => (
                <li key={request.id} className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
                  <Avatar
                    firstname={request.receiver.firstname}
                    surname={request.receiver.surname}
                    size="sm"
                  />
                  {request.receiver.firstname} {request.receiver.surname}
                  <span className="text-stone-400 dark:text-stone-500">· sent {agoInWords(request.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

    </Layout>
  );
}

// One friend: who they are, a peek at their shelf, what's between you
// "Piranesi", "Piranesi and Dune", "Piranesi, Dune and Middlemarch",
// "Piranesi, Dune and 3 more"
function listTitles(titles: string[]) {
  if (titles.length <= 1) return titles[0] ?? "";
  if (titles.length <= 3) return `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
  return `${titles.slice(0, 2).join(", ")} and ${titles.length - 2} more`;
}

function FriendCard({ friend }: { friend: Friend }) {
  const fetcher = useFetcher();
  const removing = fetcher.state !== "idle";
  // Hidden from your feed, shown as changed the moment it's clicked
  const feedFetcher = useFetcher();
  const asked = feedFetcher.formData?.get("intent");
  const hidden = asked ? asked === "hide" : friend.hiddenFromFeed;
  const shelf = `/friend/${friend.id}`;
  const name = `${friend.firstname} ${friend.surname}`;
  const loans = friend.hasOfMine + friend.iHaveOfTheirs;
  // Five slots: the newest covers, the last one saying how many more
  const covers = friend.bookCount > 5 ? friend.recent.slice(0, 4) : friend.recent;
  const more = friend.bookCount - covers.length;

  return (
    <li
      className={`flex flex-col rounded-xl border border-stone-200 dark:border-stone-800 p-4 transition-opacity ${
        removing ? "opacity-40" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <Link to={shelf} tabIndex={-1} aria-hidden="true">
          <Avatar firstname={friend.firstname} surname={friend.surname} icon={friend.profileEmoji} />
        </Link>
        <div className="min-w-0">
          <Link
            to={shelf}
            className="block truncate font-semibold text-stone-900 dark:text-stone-100 hover:underline underline-offset-2"
          >
            {name}
          </Link>
          <p className="truncate text-sm text-stone-500 dark:text-stone-400">
            {[friend.email, friend.since ? `Friends since ${monthYear(friend.since)}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      {covers.length > 0 ? (
        <ul
          className="mt-4 grid grid-cols-5 gap-2"
          aria-label={`Recently added to ${friend.firstname}'s shelf`}
        >
          {covers.map((book) => (
            <li key={book.id}>
              <Link to={`/books/${book.id}`} title={book.title} className="block hover:opacity-90 transition-opacity">
                <BookCover cover={book.cover} title={book.title} author={book.author} alt={book.title} className="aspect-[2/3]" />
              </Link>
            </li>
          ))}
          {more > 0 ? (
            <li>
              <Link
                to={shelf}
                aria-label={`${more} more on ${friend.firstname}'s shelf`}
                className="flex aspect-[2/3] items-center justify-center rounded-xs bg-stone-50 dark:bg-stone-900 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              >
                +{more}
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}

      <ul className="mt-4 mb-4 space-y-1.5 text-sm text-stone-600 dark:text-stone-300 [&_svg]:flex-shrink-0 [&_svg]:text-stone-400 dark:[&_svg]:text-stone-500">
        <li className="flex items-center gap-2">
          <BookIcon size={14} />
          {friend.bookCount
            ? `${plural(friend.bookCount, "book")}, ${friend.availableCount} on the shelf now`
            : "No books on their shelf yet"}
        </li>
        {friend.inCommon.length ? (
          <li className="flex items-center gap-2 min-w-0">
            <CommonIcon size={14} />
            <span className="truncate" title={friend.inCommon.map((book) => book.title).join(", ")}>
              {friend.inCommon.length} in common: {listTitles(friend.inCommon.map((book) => book.title))}
            </span>
          </li>
        ) : null}
        {friend.hasOfMine ? (
          <li className="flex items-center gap-2">
            <LentIcon size={14} />
            Has {friend.hasOfMine} of your books
          </li>
        ) : null}
        {friend.iHaveOfTheirs ? (
          <li className="flex items-center gap-2">
            <BorrowedIcon size={14} />
            You have {friend.iHaveOfTheirs} of theirs
          </li>
        ) : null}
        {friend.wanted ? (
          <li className="flex items-center gap-2">
            <BookmarkIcon size={14} />
            <Link to="/want-to-read" className="hover:underline underline-offset-2">
              Has {friend.wanted} from your want-to-read list
            </Link>
          </li>
        ) : null}
        {hidden ? (
          <li className="flex items-center gap-2">
            <FeedIcon size={14} strokeWidth={1.5} />
            Hidden from your feed
          </li>
        ) : null}
        {friend.lastAddedAt ? (
          <li className="flex items-center gap-2">
            <ClockIcon size={14} />
            Last added a book {agoInWords(friend.lastAddedAt)}
          </li>
        ) : null}
      </ul>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-stone-100 dark:border-stone-800 pt-3">
        <Link
          to={shelf}
          className="text-sm font-medium text-stone-800 dark:text-stone-200 hover:text-stone-950 dark:hover:text-white"
        >
          See their shelf →
        </Link>
        <span className="flex items-center gap-4">
          <feedFetcher.Form method="post">
            <input type="hidden" name="intent" value={hidden ? "show" : "hide"} />
            <input type="hidden" name="friendId" value={friend.id} />
            <button
              type="submit"
              title={
                hidden
                  ? `Show what ${friend.firstname} adds and writes in your feed again`
                  : `Stop seeing what ${friend.firstname} adds and writes in your feed. You stay friends.`
              }
              className="text-sm text-stone-400 dark:text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
            >
              {hidden ? "Show in feed" : "Hide from feed"}
            </button>
          </feedFetcher.Form>
          <fetcher.Form
            method="post"
            onSubmit={(event) => {
              const message =
                `Remove ${friend.firstname} as a friend? You won't see each other's shelves any more.` +
                (loans ? " Books already lent between you stay lent until they're returned." : "");
              if (!confirm(message)) event.preventDefault();
            }}
          >
            <input type="hidden" name="intent" value="remove" />
            <input type="hidden" name="friendId" value={friend.id} />
            <button
              type="submit"
              disabled={removing}
              className="text-sm text-stone-400 dark:text-stone-500 hover:text-rose-700 dark:hover:text-rose-400 transition-colors"
            >
              {removing ? "Removing…" : "Remove"}
            </button>
          </fetcher.Form>
        </span>
      </div>
    </li>
  );
}


function IncomingRequest({
  request,
  compact = false,
}: {
  request: LoaderData<typeof loader>["incoming"][number];
  // In the side column: smaller, with the buttons under the name
  compact?: boolean;
}) {
  const fetcher = useFetcher<ActionData>();
  const answering = fetcher.formData?.get("intent");
  if (compact) {
    // A small card: who, then the two answers side by side across it
    const answer =
      "inline-flex h-8 flex-1 items-center justify-center rounded-md text-sm transition-colors disabled:opacity-50";
    return (
      <li className="rounded-xl border border-stone-200 dark:border-stone-800 p-3">
        <div className="flex items-center gap-3">
          <Avatar
            firstname={request.sender.firstname}
            surname={request.sender.surname}
            icon={request.sender.profileEmoji}
            size="list"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
              {request.sender.firstname} {request.sender.surname}
            </p>
            <p className="text-xs text-stone-500 dark:text-stone-400">Asked {agoInWords(request.createdAt)}</p>
          </div>
        </div>
        <fetcher.Form method="post" className="mt-3 flex gap-2">
          <input type="hidden" name="notificationId" value={request.id} />
          <button
            type="submit"
            name="intent"
            value="accept"
            disabled={Boolean(answering)}
            className={`${answer} bg-forest-600 font-medium text-white hover:bg-forest-700`}
          >
            {answering === "accept" ? "Adding…" : "Accept"}
          </button>
          <button
            type="submit"
            name="intent"
            value="decline"
            disabled={Boolean(answering)}
            className={`${answer} border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500`}
          >
            Not now
          </button>
        </fetcher.Form>
      </li>
    );
  }
  return (
    <li className="flex items-center gap-3 rounded-xl border border-stone-200 dark:border-stone-800 p-4">
      <Avatar
        firstname={request.sender.firstname}
        surname={request.sender.surname}
        icon={request.sender.profileEmoji}
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-stone-900 dark:text-stone-100">
          {request.sender.firstname} {request.sender.surname}
        </p>
        <p className="text-sm text-stone-500 dark:text-stone-400">Asked {agoInWords(request.createdAt)}</p>
      </div>
      <fetcher.Form method="post" className="flex flex-shrink-0 gap-2">
        <input type="hidden" name="notificationId" value={request.id} />
        <button type="submit" name="intent" value="decline" disabled={Boolean(answering)} className={quietButton("md")}>
          Not now
        </button>
        <button type="submit" name="intent" value="accept" disabled={Boolean(answering)} className={primaryButton("md")}>
          {answering === "accept" ? "Adding…" : "Accept"}
        </button>
      </fetcher.Form>
    </li>
  );
}

