import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import invariant from "tiny-invariant";
import { getUserByShareToken } from "~/models/user.server";
import { getPublicBookListItems } from "~/models/book.server";
import { useLoaderData } from "@remix-run/react";
import Library from "~/components/library";

export const loader = async ({ params }: LoaderFunctionArgs) => {
  invariant(params.token, "token not found");

  const user = await getUserByShareToken(params.token);

  if (!user) {
    throw new Response("Not Found", { status: 404 });
  }

  const bookListItems = await getPublicBookListItems(user.id);

  return json({
    ownerName: `${user.firstname} ${user.surname}`,
    bookListItems,
  });
};

export default function PublicSharePage() {
  const data = useLoaderData<typeof loader>();

  return <Library bookListItems={data.bookListItems} />;
}
