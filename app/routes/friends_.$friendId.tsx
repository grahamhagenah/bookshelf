import type { LoaderFunctionArgs } from "@remix-run/node";
import invariant from "tiny-invariant";
import { getUserBySlug } from "~/models/user.server";
import Library from "~/components/library";
import { getBookListItems } from "~/models/book.server";
import { Link, useLoaderData } from "@remix-run/react";
import { useLocation } from "@remix-run/react";

export const handle = {
  breadcrumb: () => <Link to={useLocation().pathname}>Friend</Link>
}

export const loader = async ({ params }: LoaderFunctionArgs) => {
  invariant(params.friendId, "friendId not found");
  const slug = params.friendId;

  const user = await getUserBySlug(slug);

  if (!user) {
    throw new Response("Not Found", { status: 404 });
  }

  const bookListItems = await getBookListItems(user.id);

  const data = {
    user,
    friendName: `${user.firstname} ${user.surname}`,
    bookListItems,
  };

  return ({ data });
};


export default function FriendsBookPage() {
  const { data } = useLoaderData<typeof loader>();

  return (
    <>
      <div className="bg-blue-50 border-b border-blue-200 px-4 md:px-8 py-3">
        <p className="text-blue-800 text-center">
          Viewing <span className="font-semibold">{data.friendName}</span>&apos;s bookshelf
        </p>
      </div>
      <Library />
    </>
  );
}