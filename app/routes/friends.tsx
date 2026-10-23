import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
  SerializeFrom,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher, Link, Form, useActionData } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";

import Avatar from "~/components/avatar";
import CopyButton from "~/components/copy-button";
import CoverPlaceholder from "~/components/cover-placeholder";
import {
  BookIcon,
  BookmarkIcon,
  BorrowedIcon,
  ClockIcon,
  LentIcon,
  SearchIcon,
} from "~/components/icons";
import Layout from "~/components / Layout/Layout";
import { canInteract, respondAsDemoPersona } from "~/models/demo.server";
import {
  answerFriendRequest,
  getFriendCards,
  getFriendInvite,
  getIncomingFriendRequests,
  removeFriend,
} from "~/models/friend.server";
import {
  getUserById,
  createNotification,
  getUserByEmail,
  getSuggestedFriends,
  getPendingFriendRequests,
} from "~/models/user.server";
import { publicOrigin } from "~/origin.server";
import { friendLimitMessage, LIMIT_MESSAGES, UPGRADE_PATH } from "~/plan";
import { roomForFriend } from "~/plan.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";
import { coverSrc, isDemoEmail } from "~/utils";

export const meta: MetaFunction = () =>
  seo({ title: "Friends", noindex: true });

export const handle = {
  breadcrumb: () => <Link to="/friends">Friends</Link>,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const [friends, incoming, suggestedFriends, pendingRequests, invite] = await Promise.all([
    getFriendCards(userId),
    getIncomingFriendRequests(userId),
    getSuggestedFriends(userId, 5),
    getPendingFriendRequests(userId),
    getFriendInvite(userId),
  ]);
  return json({
    friends,
    incoming,
    suggestedFriends,
    pendingRequests,
    inviteUrl: `${publicOrigin(request)}/invite/${invite}`,
  });
};

interface ActionData {
  errors: { email?: string } | null;
  success: boolean;
  friendId?: string;
  // A friendship the free plan's limit stopped
  limit?: string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const friendId = formData.get("friendId");

  if (intent === "remove" && typeof friendId === "string") {
    await removeFriend(userId, friendId);
    return json<ActionData>({ errors: null, success: true });
  }

  const notificationId = formData.get("notificationId");
  if ((intent === "accept" || intent === "decline") && typeof notificationId === "string") {
    const result = await answerFriendRequest(userId, notificationId, intent === "accept");
    if (result === "full" || result === "they-are-full") {
      return json<ActionData>({ errors: null, success: false, limit: friendLimitMessage(result) }, { status: 403 });
    }
    return json<ActionData>({ errors: null, success: true });
  }

  const user = await getUserById(userId);
  if (!user) {
    return json<ActionData>({ errors: { email: "User not found" }, success: false }, { status: 404 });
  }
  const senderName = `${user.firstname} ${user.surname}`;

  // No new requests once the free plan's friends are all taken
  if (!(await roomForFriend(userId))) {
    return json<ActionData>({ errors: null, success: false, limit: LIMIT_MESSAGES.friends }, { status: 403 });
  }

  // A request to someone found in search or suggestions
  if (typeof friendId === "string" && friendId.length > 0) {
    if (!(await canInteract(userId, friendId))) {
      return json<ActionData>({ errors: { email: "User not found" }, success: false }, { status: 404 });
    }
    const friendRequest = await createNotification(userId, friendId, senderName);
    await respondAsDemoPersona(friendRequest.id);
    return json<ActionData>({ success: true, friendId, errors: null });
  }

  // A request to an exact email address
  const email = formData.get("email");
  if (typeof email !== "string" || email.trim().length === 0) {
    return json<ActionData>({ errors: { email: "Enter an email address" }, success: false }, { status: 400 });
  }
  const receiver = await getUserByEmail(email.trim());
  if (!receiver || receiver.id === userId || receiver.demoGroup !== user.demoGroup) {
    return json<ActionData>(
      { errors: { email: "Nobody on Stacks has that email address" }, success: false },
      { status: 404 },
    );
  }
  const friendRequest = await createNotification(userId, receiver.id, senderName);
  await respondAsDemoPersona(friendRequest.id);
  return json<ActionData>({ success: true, friendId: receiver.id, errors: null });
};

type Friend = SerializeFrom<typeof loader>["friends"][number];

interface SearchUser {
  id: string;
  firstname: string | null;
  surname: string | null;
  email: string;
}

const quietButton =
  "rounded-md border border-stone-200 dark:border-stone-700 px-3 py-1.5 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors disabled:opacity-50";
const primaryButton =
  "rounded-md bg-forest-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-forest-700 transition-colors disabled:opacity-50";

function ago(date: string) {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 730) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function monthYear(date: string) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export default function Friends() {
  const data = useLoaderData<typeof loader>();
  const searchFetcher = useFetcher<SearchUser[]>();
  const loadUsers = searchFetcher.load;
  const requestFetcher = useFetcher<ActionData>();
  const actionData = useActionData<typeof action>();
  const emailRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (actionData?.errors?.email) emailRef.current?.focus();
  }, [actionData]);

  // Look people up once typing pauses
  useEffect(() => {
    if (searchQuery.length < 2) return;
    const timer = setTimeout(
      () => loadUsers(`/api/search-users?q=${encodeURIComponent(searchQuery)}`),
      300,
    );
    return () => clearTimeout(timer);
  }, [searchQuery, loadUsers]);

  useEffect(() => {
    const sentTo = requestFetcher.data?.friendId;
    if (requestFetcher.data?.success && sentTo) {
      setSentRequests((prev) => new Set(prev).add(sentTo));
    }
  }, [requestFetcher.data]);

  const sendRequest = (friendId: string) =>
    requestFetcher.submit({ friendId }, { method: "post", action: "/friends" });

  // A request the free plan's friend limit stopped, from search or the email form
  const limit = requestFetcher.data?.limit ?? actionData?.limit ?? null;

  const { friends, incoming, pendingRequests } = data;
  const pendingIds = new Set(pendingRequests.map((r) => r.receiver.id));
  const askedMe = new Set(incoming.map((request) => request.sender.id));
  const suggested = data.suggestedFriends.filter(
    (user) => !pendingIds.has(user.id) && !sentRequests.has(user.id) && !askedMe.has(user.id),
  );
  const searchResults = searchQuery.length >= 2 ? searchFetcher.data ?? [] : [];
  const isSearching = searchFetcher.state === "loading";

  return (
    <Layout title="Friends">
      {limit ? (
        <p role="alert" className="rounded-lg bg-stone-100 dark:bg-stone-900 px-4 py-3 text-sm text-stone-700 dark:text-stone-200">
          {limit}{" "}
          <Link to={UPGRADE_PATH} className="font-medium text-forest-700 dark:text-forest-400 underline underline-offset-2">
            See Stacks Plus
          </Link>
        </p>
      ) : null}
      {incoming.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold">Friend requests</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {incoming.map((request) => (
              <IncomingRequest key={request.id} request={request} />
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold">
            Your friends
            {friends.length ? (
              <span className="ml-2 font-normal text-stone-400 dark:text-stone-500">
                {friends.length}
              </span>
            ) : null}
          </h2>
          <a href="#find" className="text-sm text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100">
            + Add friends
          </a>
        </div>

        {friends.length > 0 ? (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {friends.map((friend) => (
              <FriendCard key={friend.id} friend={friend} />
            ))}
          </ul>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 px-6 py-10 text-center">
            <p className="font-medium text-stone-900 dark:text-stone-100">No friends yet</p>
            <p className="mt-1 text-stone-500 dark:text-stone-400">
              Stacks is better with people to borrow from. Find someone below.
            </p>
          </div>
        )}

        {pendingRequests.length > 0 ? (
          <div className="mt-8">
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
                  <span className="text-stone-400 dark:text-stone-500">· sent {ago(request.createdAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section id="find">
        <h2 className="text-lg font-semibold">Find friends</h2>

        <InviteLink url={data.inviteUrl} />

        <h3 className="mt-8 font-medium text-stone-900 dark:text-stone-100">
          Already on Stacks?
        </h3>
        <p className="mt-1 text-stone-500 dark:text-stone-400">
          Search by name or email, then send a request. Once they say yes, you can see
          each other&apos;s shelves and borrow.
        </p>

        <div className="relative mt-4 max-w-xl">
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
            <SearchIcon size={16} />
          </div>
          <input
            type="search"
            aria-label="Search for people by name or email"
            placeholder="Name or email"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            className="w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 py-2 pl-9 pr-24 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10 transition-colors"
          />
          {isSearching ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-stone-400">
              Searching…
            </span>
          ) : null}
        </div>

        {searchQuery.length >= 2 ? (
          <div className="mt-3 max-w-xl">
            {searchResults.length > 0 ? (
              <ul className="divide-y divide-stone-100 dark:divide-stone-800 rounded-lg border border-stone-200 dark:border-stone-800">
                {searchResults.map((user) => (
                  <PersonRow
                    key={user.id}
                    firstname={user.firstname}
                    surname={user.surname}
                    detail={isDemoEmail(user.email) ? null : user.email}
                    status={
                      sentRequests.has(user.id) || pendingIds.has(user.id) ? "sent" : "none"
                    }
                    busy={requestFetcher.state !== "idle"}
                    onAdd={() => sendRequest(user.id)}
                  />
                ))}
              </ul>
            ) : !isSearching ? (
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Nobody by that name on Stacks yet.
              </p>
            ) : null}
          </div>
        ) : null}

        {suggested.length > 0 ? (
          <div className="mt-8 max-w-xl">
            <h3 className="text-sm font-medium text-stone-500 dark:text-stone-400">
              New on Stacks
            </h3>
            <ul className="mt-2 divide-y divide-stone-100 dark:divide-stone-800">
              {suggested.map((user) => (
                <PersonRow
                  key={user.id}
                  firstname={user.firstname}
                  surname={user.surname}
                  detail={`Joined ${ago(user.createdAt)}`}
                  status="none"
                  busy={requestFetcher.state !== "idle"}
                  onAdd={() => sendRequest(user.id)}
                />
              ))}
            </ul>
          </div>
        ) : null}

        <details className="mt-8 max-w-xl" open={Boolean(actionData?.errors?.email)}>
          <summary className="cursor-pointer text-sm text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100">
            Know their exact email address?
          </summary>
          <Form method="post" className="mt-3 flex gap-2">
            <input
              ref={emailRef}
              name="email"
              type="email"
              autoComplete="off"
              placeholder="friend@example.com"
              aria-label="Email address"
              aria-invalid={actionData?.errors?.email ? true : undefined}
              aria-describedby="email-error"
              className="min-w-0 flex-1 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10 transition-colors"
            />
            <button type="submit" className={`flex-shrink-0 ${primaryButton} px-4 py-2`}>
              Send request
            </button>
          </Form>
          {actionData?.errors?.email ? (
            <p id="email-error" className="mt-1 text-sm text-rose-700 dark:text-rose-400">
              {actionData.errors.email}
            </p>
          ) : actionData?.success && actionData.friendId ? (
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Request sent.</p>
          ) : null}
        </details>
      </section>
    </Layout>
  );
}

// Your personal invite: whoever opens it becomes your friend, signing up
// first if they need to
function InviteLink({ url }: { url: string }) {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);
  const share = () =>
    navigator.share({ title: "Join me on Stacks", text: "Borrow books from my shelf on Stacks", url }).catch(() => {
      // Closing the share sheet isn't an error worth showing
    });
  return (
    <div className="mt-4 max-w-xl rounded-xl border border-stone-200 dark:border-stone-800 p-4">
      <h3 className="font-medium text-stone-900 dark:text-stone-100">Invite someone new</h3>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        Send this link to a friend. When they open it and sign up, you&apos;re friends
        straight away, no request needed.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          readOnly
          value={url}
          aria-label="Your invite link"
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3 py-1.5 text-sm text-stone-700 dark:text-stone-300"
        />
        <CopyButton value={url} className={`flex-shrink-0 ${quietButton}`} />
        {canShare ? (
          <button type="button" onClick={share} className={`flex-shrink-0 ${primaryButton}`}>
            Share
          </button>
        ) : null}
      </div>
    </div>
  );
}

// One friend: who they are, a peek at their shelf, what's between you
function FriendCard({ friend }: { friend: Friend }) {
  const fetcher = useFetcher();
  const removing = fetcher.state !== "idle";
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
                <MiniCover cover={book.cover} title={book.title} author={book.author} />
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
        {friend.lastAddedAt ? (
          <li className="flex items-center gap-2">
            <ClockIcon size={14} />
            Last added a book {ago(friend.lastAddedAt)}
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
      </div>
    </li>
  );
}

function MiniCover({ cover, title, author }: { cover: string; title: string; author: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative aspect-[2/3] overflow-hidden rounded-xs ring-1 ring-stone-900/5 dark:ring-white/10">
      <CoverPlaceholder title={title} author={author} className="absolute inset-0" />
      {cover && !failed ? (
        <img
          src={coverSrc(cover, "M")}
          alt={title}
          loading="lazy"
          // Visible from the first paint, over the placeholder; gone if
          // there's no picture (Open Library answers some with a 1px image)
          onLoad={(e) => setFailed(e.currentTarget.naturalWidth <= 1)}
          onError={() => setFailed(true)}
          className="relative h-full w-full object-cover"
        />
      ) : null}
    </div>
  );
}

function IncomingRequest({
  request,
}: {
  request: SerializeFrom<typeof loader>["incoming"][number];
}) {
  const fetcher = useFetcher<ActionData>();
  const answering = fetcher.formData?.get("intent");
  const limit = fetcher.data?.limit;
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
        {limit ? (
          <p className="text-sm text-stone-600 dark:text-stone-300">
            {limit}{" "}
            <Link to={UPGRADE_PATH} className="font-medium text-forest-700 dark:text-forest-400 underline underline-offset-2">
              See Stacks Plus
            </Link>
          </p>
        ) : (
          <p className="text-sm text-stone-500 dark:text-stone-400">Asked {ago(request.createdAt)}</p>
        )}
      </div>
      <fetcher.Form method="post" className="flex flex-shrink-0 gap-2">
        <input type="hidden" name="notificationId" value={request.id} />
        <button type="submit" name="intent" value="decline" disabled={Boolean(answering)} className={quietButton}>
          Not now
        </button>
        <button type="submit" name="intent" value="accept" disabled={Boolean(answering)} className={primaryButton}>
          {answering === "accept" ? "Adding…" : "Accept"}
        </button>
      </fetcher.Form>
    </li>
  );
}

function PersonRow({
  firstname,
  surname,
  detail,
  status,
  busy,
  onAdd,
}: {
  firstname: string | null;
  surname: string | null;
  detail: string | null;
  status: "none" | "sent";
  busy: boolean;
  onAdd: () => void;
}) {
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <Avatar firstname={firstname} surname={surname} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-stone-900 dark:text-stone-100">
          {firstname} {surname}
        </p>
        {detail ? <p className="truncate text-sm text-stone-500 dark:text-stone-400">{detail}</p> : null}
      </div>
      {status === "sent" ? (
        <span className="flex-shrink-0 text-sm text-stone-400 dark:text-stone-500">Request sent</span>
      ) : (
        <button type="button" onClick={onAdd} disabled={busy} className={`flex-shrink-0 ${quietButton}`}>
          Add friend
        </button>
      )}
    </li>
  );
}
