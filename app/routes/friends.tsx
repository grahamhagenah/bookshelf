import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  useLoaderData,
  useFetcher,
  Link,
  Form,
  useActionData,
  useSearchParams,
} from "@remix-run/react";
import { useEffect, useRef, useState } from "react";

import Avatar from "~/components/avatar";
import Layout from "~/components / Layout/Layout";
import { canInteract, respondAsDemoPersona } from "~/models/demo.server";
import {
  getUserById,
  createNotification,
  getUserByEmail,
  getSuggestedFriends,
  getPendingFriendRequests,
} from "~/models/user.server";
import { requireUserId, getUserId } from "~/session.server";
import { isDemoEmail } from "~/utils";

export const handle = {
  breadcrumb: () => <Link to="/friends">Friends</Link>,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const [user, suggestedFriends, pendingRequests] = await Promise.all([
    getUserById(userId),
    getSuggestedFriends(userId, 5),
    getPendingFriendRequests(userId),
  ]);
  return { user, suggestedFriends, pendingRequests };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const senderId = await getUserId(request);
  if (!senderId) {
    return json(
      { errors: { email: "You must be logged in" }, success: false },
      { status: 401 },
    );
  }

  const user = await getUserById(senderId);
  if (!user) {
    return json(
      { errors: { email: "User not found" }, success: false },
      { status: 404 },
    );
  }

  const senderName = user.firstname + " " + user.surname;
  const formData = await request.formData();
  const friendId = formData.get("friendId");
  const email = formData.get("email");

  // Handle search-based friend request (by friendId)
  if (typeof friendId === "string" && friendId.length > 0) {
    if (!(await canInteract(senderId, friendId))) {
      return json(
        { errors: { email: "User not found" }, success: false },
        { status: 404 },
      );
    }
    const friendRequest = await createNotification(
      senderId,
      friendId,
      senderName,
    );
    await respondAsDemoPersona(friendRequest.id);
    return json({ success: true, friendId, errors: null });
  }

  // Handle email-based friend request (fallback)
  if (typeof email !== "string" || email.length === 0) {
    return json(
      { errors: { email: "Email is required" }, success: false },
      { status: 400 },
    );
  }

  const receiver = await getUserByEmail(email);
  if (!receiver || receiver.demoGroup !== user.demoGroup) {
    return json(
      { errors: { email: "No user found with this email" }, success: false },
      { status: 404 },
    );
  }

  const friendRequest = await createNotification(
    senderId,
    receiver.id,
    senderName,
  );
  await respondAsDemoPersona(friendRequest.id);

  return redirect(`/books`);
};

interface SearchUser {
  id: string;
  firstname: string | null;
  surname: string | null;
  email: string;
}

export default function Friends() {
  const data = useLoaderData<typeof loader>();
  const searchFetcher = useFetcher<SearchUser[]>();
  const loadUsers = searchFetcher.load;
  const requestFetcher = useFetcher<{ success: boolean; friendId?: string }>();

  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/books";
  const actionData = useActionData<typeof action>();
  const emailRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (actionData?.errors?.email) {
      emailRef.current?.focus();
    }
  }, [actionData]);

  // Handle search input with debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (searchQuery.length >= 2) {
      debounceRef.current = setTimeout(() => {
        loadUsers(`/api/search-users?q=${encodeURIComponent(searchQuery)}`);
      }, 300);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery, loadUsers]);

  // Track sent friend requests
  useEffect(() => {
    if (requestFetcher.data?.success && requestFetcher.data?.friendId) {
      setSentRequests((prev) =>
        new Set(prev).add(requestFetcher.data!.friendId!),
      );
    }
  }, [requestFetcher.data]);

  const handleSendRequest = (friendId: string) => {
    requestFetcher.submit({ friendId }, { method: "post", action: "/friends" });
  };

  const following = data.user?.following ?? [];
  const suggestedFriends = data.suggestedFriends ?? [];
  const pendingRequests = data.pendingRequests ?? [];
  const pendingUserIds = new Set(pendingRequests.map((r) => r.receiver.id));
  const searchResults = searchQuery.length >= 2 ? searchFetcher.data || [] : [];
  const isSearching = searchFetcher.state === "loading";

  return (
    <>
      <Layout title="Friends">
        <section className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Your Friends</h2>
          {following.length > 0 || pendingRequests.length > 0 ? (
            <>
              {following.length > 0 ? (
                <p className="text-stone-600 mb-4">
                  You have {following.length} friend
                  {following.length !== 1 ? "s" : ""}
                </p>
              ) : null}
              <ul className="divide-y">
                {following.map((user, index) => (
                  <li key={index} className="py-3 first:pt-0 last:pb-0">
                    <a
                      href={`/friend/${user.id}`}
                      className="flex items-center gap-3 hover:bg-stone-50 dark:hover:bg-stone-800 -mx-2 px-2 py-2 rounded-lg transition-colors"
                    >
                      <Avatar
                        firstname={user.firstname}
                        surname={user.surname}
                        icon={user.profileEmoji}
                      />
                      <div>
                        <h3 className="font-medium">
                          {user.firstname} {user.surname}
                        </h3>
                        {!isDemoEmail(user.email) ? (
                          <p className="text-sm text-stone-500 dark:text-stone-400">
                            {user.email}
                          </p>
                        ) : null}
                      </div>
                    </a>
                  </li>
                ))}
                {pendingRequests.map((request) => (
                  <li key={request.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3 -mx-2 px-2 py-2">
                      <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-600 font-semibold text-sm flex-shrink-0">
                        {(request.receiver.firstname?.[0] || "").toUpperCase()}
                        {(request.receiver.surname?.[0] || "").toUpperCase()}
                      </div>
                      <div className="flex-grow">
                        <h3 className="font-medium">
                          {request.receiver.firstname}{" "}
                          {request.receiver.surname}
                        </h3>
                        {!isDemoEmail(request.receiver.email) ? (
                          <p className="text-sm text-stone-500">
                            {request.receiver.email}
                          </p>
                        ) : null}
                      </div>
                      <span className="bg-stone-100 text-stone-700 text-xs px-2 py-1 rounded-full flex-shrink-0">
                        Pending
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="text-center py-8">
              <h3 className="text-xl font-medium mb-2">No friends yet</h3>
              <p className="text-stone-600">
                Search for users below to send them a friend request.
              </p>
            </div>
          )}
        </section>

        {suggestedFriends.filter((user) => !pendingUserIds.has(user.id))
          .length > 0 ? (
          <section className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">Suggested Friends</h2>
            <p className="text-stone-600 mb-4">
              People who recently joined Stacks
            </p>
            <ul className="divide-y">
              {suggestedFriends
                .filter(
                  (user) =>
                    !sentRequests.has(user.id) && !pendingUserIds.has(user.id),
                )
                .map((user) => (
                  <li
                    key={user.id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center text-stone-900 dark:text-stone-100 font-semibold text-sm flex-shrink-0">
                        {(user.firstname?.[0] || "").toUpperCase()}
                        {(user.surname?.[0] || "").toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-medium">
                          {user.firstname} {user.surname}
                        </h3>
                        <p className="text-sm text-stone-500">New member</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSendRequest(user.id)}
                      disabled={requestFetcher.state !== "idle"}
                      className="rounded bg-stone-900 dark:bg-stone-100 px-3 py-1.5 text-sm text-white dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-300 disabled:opacity-50"
                    >
                      Send Request
                    </button>
                  </li>
                ))}
              {suggestedFriends.filter(
                (user) =>
                  !sentRequests.has(user.id) && !pendingUserIds.has(user.id),
              ).length === 0 ? (
                <li className="py-3 text-stone-500">
                  You&apos;ve sent requests to all suggested friends
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        <section className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">Find Friends</h2>
          <p className="text-stone-600 mb-4">
            Search for users by name or email to send them a friend request.
          </p>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="search"
                className="block text-sm font-medium text-stone-700 mb-1"
              >
                Search by name or email
              </label>
              <div className="relative">
                <input
                  ref={searchRef}
                  id="search"
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded border border-stone-300 px-3 py-2"
                  autoComplete="off"
                />
                {isSearching ? (
                  <div className="absolute right-3 top-2.5 text-sm text-stone-400">
                    Searching...
                  </div>
                ) : null}
              </div>
            </div>

            {searchQuery.length >= 2 ? (
              <div className="border rounded-lg bg-white">
                {searchResults.length > 0 ? (
                  <ul className="divide-y">
                    {searchResults
                      .filter((user) => !sentRequests.has(user.id))
                      .map((user) => {
                        const isPending = pendingUserIds.has(user.id);
                        return (
                          <li
                            key={user.id}
                            className="p-3 flex items-center justify-between"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`w-9 h-9 rounded-full flex items-center justify-center font-medium text-sm ${isPending ? "bg-stone-100 text-stone-600" : "bg-stone-100 text-stone-900 dark:text-stone-100"}`}
                              >
                                {(user.firstname?.[0] || "").toUpperCase()}
                                {(user.surname?.[0] || "").toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium">
                                  {user.firstname} {user.surname}
                                </p>
                                {!isDemoEmail(user.email) ? (
                                  <p className="text-sm text-stone-500">
                                    {user.email}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                            {isPending ? (
                              <span className="bg-stone-100 text-stone-700 text-xs px-2 py-1 rounded-full">
                                Pending
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSendRequest(user.id)}
                                disabled={requestFetcher.state !== "idle"}
                                className="rounded bg-stone-900 dark:bg-stone-100 px-3 py-1.5 text-sm text-white dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-300 disabled:opacity-50"
                              >
                                Send Request
                              </button>
                            )}
                          </li>
                        );
                      })}
                    {searchResults.filter((user) => !sentRequests.has(user.id))
                      .length === 0 ? (
                      <li className="p-3 text-stone-500">
                        Request sent to all matching users
                      </li>
                    ) : null}
                  </ul>
                ) : !isSearching ? (
                  <p className="p-3 text-stone-500">No users found</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="border rounded-lg p-6">
          <details>
            <summary className="cursor-pointer font-medium">
              Add by email address
            </summary>
            <Form method="post" className="space-y-4 mt-4">
              <p className="text-stone-600">
                If you know someone&apos;s exact email address, you can add them
                directly.
              </p>
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-stone-700 mb-1"
                >
                  Email address
                </label>
                <input
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="text"
                  autoComplete="email"
                  aria-invalid={actionData?.errors?.email ? true : undefined}
                  aria-describedby="email-error"
                  className="w-full rounded border border-stone-300 px-3 py-2"
                />
                {actionData?.errors?.email ? (
                  <div
                    className="mt-1 text-sm text-stone-900 dark:text-stone-100"
                    id="email-error"
                  >
                    {actionData.errors.email}
                  </div>
                ) : null}
              </div>
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <button
                type="submit"
                className="rounded bg-stone-900 dark:bg-stone-100 px-4 py-2 text-white dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-300"
              >
                Send friend request
              </button>
            </Form>
          </details>
        </section>
      </Layout>
    </>
  );
}
