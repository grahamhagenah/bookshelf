import { useEffect, useState } from "react";
import { data, useFetcher, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

import Avatar from "~/components/avatar";
import { SearchIcon } from "~/components/icons";
import InviteMessage, { mailtoInvite } from "~/components/invite-message";
import Layout from "~/components/layout";
import { primaryButton, quietButton, textField } from "~/components/ui";
import { EMAILS_AT_ONCE, emailsIn } from "~/find-friends";
import { canInteract, respondAsDemoPersona } from "~/models/demo.server";
import { getFriendInvite, getIncomingFriendRequests } from "~/models/friend.server";
import {
  createNotification,
  getFriendStatus,
  getPendingFriendRequests,
  getSuggestedFriends,
  getUserByEmail,
  getUserById,
} from "~/models/user.server";
import { publicOrigin } from "~/origin.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";
import { agoInWords, isDemoEmail } from "~/utils";

// Finding people to borrow from: anyone already on Stacks, by name or a
// pasted list of addresses, and a ready-made invite for everyone else.
// Linked from the Friends page, which keeps to the friends you have.

export const meta: MetaFunction = () => seo({ title: "Add friends", noindex: true });

export const handle = {
  breadcrumbs: () => [{ label: "Friends", href: "/friends" }, { label: "Add friends" }],
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const [incoming, suggestedFriends, pendingRequests, invite] = await Promise.all([
    getIncomingFriendRequests(userId),
    getSuggestedFriends(userId, 5),
    getPendingFriendRequests(userId),
    getFriendInvite(userId),
  ]);
  return data({
    // Who's already been asked, either way, to leave out of suggestions
    pendingIds: pendingRequests.map((request) => request.receiver.id),
    askedMeIds: incoming.map((request) => request.sender.id),
    suggestedFriends,
    inviteUrl: `${publicOrigin(request)}/invite/${invite}`,
  });
};

interface ActionData {
  errors: { email?: string } | null;
  success: boolean;
  friendId?: string;
  // From a list of email addresses: who's on Stacks (and what happened),
  // and the addresses that aren't yet, to invite
  found?: { name: string; status: "sent" | "friends" | "asked" }[];
  missing?: string[];
}

// A request to someone found by name, or to everyone behind a list of
// addresses
export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const friendId = formData.get("friendId");

  const user = await getUserById(userId);
  if (!user) {
    return data<ActionData>({ errors: { email: "User not found" }, success: false }, { status: 404 });
  }
  const senderName = `${user.firstname} ${user.surname}`;

  // A request to someone found in search or suggestions
  if (typeof friendId === "string" && friendId.length > 0) {
    if (!(await canInteract(userId, friendId))) {
      return data<ActionData>({ errors: { email: "User not found" }, success: false }, { status: 404 });
    }
    const friendRequest = await createNotification(userId, friendId, senderName);
    await respondAsDemoPersona(friendRequest.id);
    return data<ActionData>({ success: true, friendId, errors: null });
  }

  // Requests to the people behind a list of email addresses
  const pasted = formData.get("email");
  const addresses = typeof pasted === "string" ? emailsIn(pasted) : [];
  if (addresses.length === 0) {
    return data<ActionData>({ errors: { email: "Enter an email address" }, success: false }, { status: 400 });
  }
  if (addresses.length > EMAILS_AT_ONCE) {
    return data<ActionData>(
      { errors: { email: `Up to ${EMAILS_AT_ONCE} addresses at a time, please` }, success: false },
      { status: 400 },
    );
  }
  const found: NonNullable<ActionData["found"]> = [];
  const missing: string[] = [];
  for (const address of addresses) {
    const receiver = await getUserByEmail(address);
    // An account still waiting on a loan email isn't on Stacks yet
    if (!receiver || receiver.invitedAt || receiver.demoGroup !== user.demoGroup) {
      missing.push(address);
      continue;
    }
    if (receiver.id === userId) continue;
    const name = `${receiver.firstname} ${receiver.surname}`.trim();
    const status = await getFriendStatus(userId, receiver.id);
    if (status === "friends") found.push({ name, status: "friends" });
    else if (status === "requested") found.push({ name, status: "sent" });
    else if (status === "invited") found.push({ name, status: "asked" });
    else {
      const friendRequest = await createNotification(userId, receiver.id, senderName);
      await respondAsDemoPersona(friendRequest.id);
      found.push({ name, status: "sent" });
    }
  }
  return data<ActionData>({ errors: null, success: true, found, missing });
};

interface SearchUser {
  id: string;
  firstname: string | null;
  surname: string | null;
  email: string;
}

export default function AddFriends() {
  const data = useLoaderData<typeof loader>();
  const searchFetcher = useFetcher<SearchUser[]>();
  const loadUsers = searchFetcher.load;
  const requestFetcher = useFetcher<ActionData>();
  const [searchQuery, setSearchQuery] = useState("");
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

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
    requestFetcher.submit({ friendId }, { method: "post", action: "/friends/add" });

  const pendingIds = new Set(data.pendingIds);
  const askedMe = new Set(data.askedMeIds);
  const suggested = data.suggestedFriends.filter(
    (user) => !pendingIds.has(user.id) && !sentRequests.has(user.id) && !askedMe.has(user.id),
  );
  const searchResults = searchQuery.length >= 2 ? searchFetcher.data ?? [] : [];
  const isSearching = searchFetcher.state === "loading";

  return (
    <Layout title="Add friends">
      <section>
        <h2 className="text-lg font-semibold">Already on Stacks?</h2>
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
                  detail={`Joined ${agoInWords(user.createdAt)}`}
                  status="none"
                  busy={requestFetcher.state !== "idle"}
                  onAdd={() => sendRequest(user.id)}
                />
              ))}
            </ul>
          </div>
        ) : null}

        <FindByEmail inviteUrl={data.inviteUrl} />

        <InviteMessage
          url={data.inviteUrl}
          title="Invite someone new"
          intro="Send this to friends who aren't on Stacks. When they open the link and sign up, you're friends straight away."
          className="mt-10"
        />
      </section>
    </Layout>
  );
}

// Paste the addresses of people you lend to: anyone already on Stacks gets
// a friend request, and the rest are a ready-made invite away
function FindByEmail({ inviteUrl }: { inviteUrl: string }) {
  const fetcher = useFetcher<ActionData>();
  const busy = fetcher.state !== "idle";
  const result = fetcher.state === "idle" ? fetcher.data : undefined;
  const sent = result?.found?.filter((person) => person.status === "sent") ?? [];
  const already = result?.found?.filter((person) => person.status !== "sent") ?? [];
  const missing = result?.missing ?? [];
  const names = (people: { name: string }[]) => people.map((person) => person.name).join(", ");

  return (
    <div id="by-email" className="mt-8 max-w-xl scroll-mt-24">
      <h3 className="font-medium text-stone-900 dark:text-stone-100">Find friends by email</h3>
      <p className="mt-1 text-stone-500 dark:text-stone-400">
        Paste the email addresses of people you lend to. Anyone already here gets a friend
        request, and you can invite the rest.
      </p>
      <fetcher.Form method="post" action="/friends/add" className="mt-3 space-y-2">
        <textarea
          name="email"
          rows={3}
          autoComplete="off"
          placeholder="maya@example.com, sam@example.com"
          aria-label="Email addresses"
          aria-invalid={result?.errors?.email ? true : undefined}
          aria-describedby="email-error"
          className={`${textField} block`}
        />
        <button type="submit" disabled={busy} className={`${primaryButton("md")} px-4 py-2`}>
          {busy ? "Looking…" : "Find friends"}
        </button>
      </fetcher.Form>
      {result?.errors?.email ? (
        <p id="email-error" className="mt-2 text-sm text-rose-700 dark:text-rose-400">
          {result.errors.email}
        </p>
      ) : null}
      {result?.success ? (
        <div role="status" className="mt-3 space-y-2 text-sm text-stone-600 dark:text-stone-300">
          {sent.length > 0 ? <p>Friend request sent to {names(sent)}.</p> : null}
          {already.length > 0 ? (
            <p className="text-stone-500 dark:text-stone-400">
              Already connected: {names(already)}.
            </p>
          ) : null}
          {missing.length > 0 ? (
            <div className="rounded-lg bg-stone-50 dark:bg-stone-900 px-3 py-2.5">
              <p>
                Not on Stacks yet: <span className="break-words">{missing.join(", ")}</span>
              </p>
              <a
                href={mailtoInvite(inviteUrl, missing)}
                className="mt-2 inline-flex h-8 items-center rounded-md bg-forest-600 px-3 text-sm font-medium text-white hover:bg-forest-700 transition-colors"
              >
                Email them an invite
              </a>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
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
        <button type="button" onClick={onAdd} disabled={busy} className={`flex-shrink-0 ${quietButton("md")}`}>
          Add friend
        </button>
      )}
    </li>
  );
}
