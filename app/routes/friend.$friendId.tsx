import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import invariant from "tiny-invariant";
import { getUserById } from "~/models/user.server";
import Library from "~/components/library";
import { getBookListItems } from "~/models/book.server";
import { Link, useLoaderData } from "@remix-run/react";
import { useLocation } from "@remix-run/react";
import { requireUserId } from "~/session.server";

export const handle = {
  breadcrumb: () => <Link to={useLocation().pathname}>Friend</Link>
}

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
      <div className="bg-blue-50 border-b border-blue-200 px-4 md:px-8 py-3">
        <p className="text-blue-800 text-center">
          Viewing <span className="font-semibold">{data.friendName}</span>&apos;s bookshelf
        </p>
      </div>
      <Library bookListItems={data.bookListItems} />
    </>
  );
}
