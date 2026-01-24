import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { requireUserId, getUserId } from "~/session.server";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { getUserById, createNotification, getUserByEmail } from "~/models/user.server";
import { Form, useActionData, useSearchParams } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import Layout from "~/components / Layout/Layout";


export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  return { user };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const senderId = await getUserId(request);
  if (!senderId) {
    return json(
      { errors: { email: "You must be logged in" }, success: false },
      { status: 401 }
    );
  }

  const user = await getUserById(senderId);
  if (!user) {
    return json(
      { errors: { email: "User not found" }, success: false },
      { status: 404 }
    );
  }

  const senderName = user.firstname + " " + user.surname;
  const formData = await request.formData();
  const friendId = formData.get("friendId");
  const email = formData.get("email");

  // Handle search-based friend request (by friendId)
  if (typeof friendId === "string" && friendId.length > 0) {
    await createNotification(senderId, friendId, senderName);
    return json({ success: true, friendId, errors: null });
  }

  // Handle email-based friend request (fallback)
  if (typeof email !== "string" || email.length === 0) {
    return json(
      { errors: { email: "Email is required" }, success: false },
      { status: 400 }
    );
  }

  const receiver = await getUserByEmail(email);
  if (!receiver) {
    return json(
      { errors: { email: "No user found with this email" }, success: false },
      { status: 404 }
    );
  }

  await createNotification(senderId, receiver.id, senderName);

  return redirect(`/books`);
};


type SearchUser = {
  id: string;
  firstname: string | null;
  surname: string | null;
  email: string;
};

export default function Friends() {
  const data = useLoaderData<typeof loader>();
  const searchFetcher = useFetcher<SearchUser[]>();
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
        searchFetcher.load(`/api/search-users?q=${encodeURIComponent(searchQuery)}`);
      }, 300);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [searchQuery]);

  // Track sent friend requests
  useEffect(() => {
    if (requestFetcher.data?.success && requestFetcher.data?.friendId) {
      setSentRequests((prev) => new Set(prev).add(requestFetcher.data!.friendId!));
    }
  }, [requestFetcher.data]);

  const handleSendRequest = (friendId: string) => {
    requestFetcher.submit(
      { friendId },
      { method: "post", action: "/friends" }
    );
  };

  const following = data.user?.following ?? [];
  const searchResults = searchQuery.length >= 2 ? (searchFetcher.data || []) : [];
  const isSearching = searchFetcher.state === "loading";

  return (
    <Layout title="Friends">
      <section className="p-4 m-4">
        {following.length > 1 ?
          <h2>You have <span className="font-semibold pb-16">{following.length}</span> friends</h2>
          : null }
          <ul className="friend-list my-5 text-xl mt-16">
          {following.length > 0 ?
            following.map((user, index) => {
              return (
                <li key={index} className="first:pt-0 border-b-2 py-4 px-4 last:border-none">
                  <a href={`/friend/${user.id}`}>
                    <h3 className="text-xl font-medium mb-1">{user.firstname + " " + user.surname}</h3>
                    <p className="font-regular">{user.email}</p>
                  </a>
                </li>
              );
            })
          :
            <li>
              <h3 className="text-3xl font-regular mb-8">You have no friends :(</h3>
              <p className="font-regular">You're missing out if you go it alone. Add friends from this page by searching for their name or email.</p>
            </li>
          }
          </ul>
        </section>
        <section className="p-4">
          <div className="space-y-6 border shadow-sm rounded-lg p-8 md:p-12 w-full mb-8">
            <h2 className="text-3xl font-semibold mb-5">Find friends</h2>
            <p className="pb-4">Search for users by name or email to send them a friend request.</p>
            <label
              htmlFor="search"
              className="block text-sm font-medium text-gray-700"
            >
              Search by name or email
            </label>
            <div className="relative mt-1">
              <input
                ref={searchRef}
                id="search"
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded border border-gray-500 px-2 py-1 text-lg"
                autoComplete="off"
              />
              {isSearching && (
                <div className="absolute right-3 top-2 text-gray-400">
                  Searching...
                </div>
              )}
            </div>

            {/* Search Results Dropdown */}
            {searchQuery.length >= 2 && (
              <div className="mt-2 border rounded-lg bg-white shadow-sm">
                {searchResults.length > 0 ? (
                  <ul className="divide-y">
                    {searchResults
                      .filter((user) => !sentRequests.has(user.id))
                      .map((user) => (
                        <li key={user.id} className="p-4 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                              {(user.firstname?.[0] || "").toUpperCase()}
                              {(user.surname?.[0] || "").toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">
                                {user.firstname} {user.surname}
                              </p>
                              <p className="text-sm text-gray-500">{user.email}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSendRequest(user.id)}
                            disabled={requestFetcher.state !== "idle"}
                            className="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600 focus:bg-blue-400 disabled:opacity-50"
                          >
                            Send Request
                          </button>
                        </li>
                      ))}
                    {searchResults.filter((user) => !sentRequests.has(user.id)).length === 0 && (
                      <li className="p-4 text-gray-500">
                        Request sent to all matching users
                      </li>
                    )}
                  </ul>
                ) : !isSearching ? (
                  <p className="p-4 text-gray-500">No users found</p>
                ) : null}
              </div>
            )}
          </div>

          {/* Fallback: Manual email input */}
          <details className="border shadow-sm rounded-lg p-8 md:p-12 w-full mb-16">
            <summary className="cursor-pointer text-lg font-medium">
              Add by email address
            </summary>
            <Form method="post" className="space-y-6 mt-6">
              <p>If you know someone's exact email address, you can add them directly.</p>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email address
              </label>
              <div className="mt-1">
                <input
                  ref={emailRef}
                  id="email"
                  name="email"
                  type="text"
                  autoComplete="email"
                  aria-invalid={actionData?.errors?.email ? true : undefined}
                  aria-describedby="email-error"
                  className="w-full rounded border border-gray-500 px-2 py-1 text-lg"
                />
                {actionData?.errors?.email ? (
                  <div className="pt-1 text-red-700" id="email-error">
                    {actionData.errors.email}
                  </div>
                ) : null}
              </div>
              <input type="hidden" name="redirectTo" value={redirectTo} />
              <button
                type="submit"
                className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400"
              >
                Send friend request
              </button>
            </Form>
          </details>
        </section>
    </Layout>
  );
}
