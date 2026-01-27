import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import invariant from "tiny-invariant";
import { getUserById } from "~/models/user.server";
import Library from "~/components/library";
import { getBookListItems } from "~/models/book.server";
import { Link, useLoaderData } from "@remix-run/react";
import { requireUserId } from "~/session.server";
import Breadcrumbs from "~/components/breadcrumbs";

type LoaderData = {
  friendName: string;
};

export const handle = {
  breadcrumbs: (data: LoaderData) => [
    { label: "Friends", href: "/friends" },
    { label: data?.friendName || "Friend" },
  ],
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const currentUserId = await requireUserId(request);
  invariant(params.friendId, "friendId not found");

  const user = await getUserById(params.friendId);

  if (!user) {
    throw new Response("Not Found", { status: 404 });
  }

  // Verify the current user is friends with this person
  const currentUser = await getUserById(currentUserId);
  const followingIds = currentUser?.following?.map(f => f.id) ?? [];

  if (!followingIds.includes(params.friendId)) {
    throw new Response("Not Found", { status: 404 });
  }

  const bookListItems = await getBookListItems(user.id);

  return json({
    user,
    friendName: `${user.firstname} ${user.surname}`,
    bookListItems,
  });
};


export default function FriendsBookPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <>
      <Breadcrumbs />
      <div className="sm:hidden px-4 py-2 text-sm text-gray-500 border-b border-gray-100">
        {data.friendName}&apos;s library
      </div>
      <Library bookListItems={data.bookListItems} ownerName={data.friendName} />
    </>
  );
}
