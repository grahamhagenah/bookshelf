import type { LoaderFunctionArgs } from "@remix-run/node";
import invariant from "tiny-invariant";
import { getUserById } from "~/models/user.server";
import Library from "~/components/library";
import { getBookListItems } from "~/models/book.server";
import { Link } from "@remix-run/react";
import { useParams } from "@remix-run/react";
import { useLocation } from "@remix-run/react";

export const handle = {
  breadcrumb: () => <Link to={useLocation().pathname}>Friend</Link>
}
  
export const loader = async ({ params }: LoaderFunctionArgs) => {
  invariant(params.friendId, "friendId not found");
  const friendId = params.friendId

  const user = await getUserById(params.friendId);
  const bookListItems = await getBookListItems( friendId );

  if (!user) {
    throw new Response("Not Found", { status: 404 });
  }

  const data = {
    user,
    friendId,
    bookListItems,
  };
  
  return ({data});
};


export default function FriendsBookPage() {

  return (
    <Library />
  )
}