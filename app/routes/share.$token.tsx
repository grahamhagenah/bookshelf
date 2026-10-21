import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

import Library from "~/components/library";
import { getPublicBookListItems } from "~/models/book.server";
import { getUserByShareToken } from "~/models/user.server";

export const handle = {
  breadcrumb: (data: { ownerName?: string } | undefined) => (
    <span>{data?.ownerName ? `${data.ownerName}'s library` : "Library"}</span>
  ),
};

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

  return (
    <>
      <Library bookListItems={data.bookListItems} ownerName={data.ownerName} />
    </>
  );
}
