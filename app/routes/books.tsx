import type { LoaderFunctionArgs } from "@remix-run/node";
import { NavLink, Outlet, useLoaderData } from "@remix-run/react";
import { getBookListItems } from "~/models/book.server";
import { requireUserId } from "~/session.server";
import { getUserById } from "~/models/user.server";
import Library from "~/components/library";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId)
  const bookListItems = await getBookListItems(userId);

  const data = {
    user,
    bookListItems,
  };

  return ({data});
}

export default function BooksPage() {

  return (
    <>
      <Library />
    </>
  );
}
