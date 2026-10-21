import type {
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import invariant from "tiny-invariant";

import Library from "~/components/library";
import { getPublicBookListItems } from "~/models/book.server";
import { getUserByShareToken } from "~/models/user.server";
import { publicOrigin } from "~/origin.server";
import { seo } from "~/seo";

// What iMessage, Slack and friends show when the link is pasted
export const meta: MetaFunction<typeof loader> = ({ data, params }) =>
  seo({
    title: data?.ownerName ? `${data.ownerName}'s bookshelf` : "Bookshelf",
    description: data ? shelfSummary(data.ownerName, data.bookCount, data.sampleTitles) : undefined,
    path: `/share/${params.token}`,
    image: data ? `${data.origin}/share/${params.token}/preview.png` : undefined,
    noindex: true,
  });

// "18 books on Jordan Avery's shelf, including Dune, Piranesi and Circe."
function shelfSummary(name: string, count: number, titles: string[]) {
  const books = `${count} ${count === 1 ? "book" : "books"} on ${name}'s shelf`;
  if (titles.length === 0) return `${books}. Browse them on Stacks.`;
  const list =
    titles.length === 1
      ? titles[0]
      : `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
  return `${books}, including ${list}.`;
}

export const handle = {
  breadcrumb: (data: { ownerName?: string } | undefined) => (
    <span>{data?.ownerName ? `${data.ownerName}'s library` : "Library"}</span>
  ),
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  invariant(params.token, "token not found");

  const user = await getUserByShareToken(params.token);

  if (!user) {
    throw new Response("Not Found", { status: 404 });
  }

  const bookListItems = await getPublicBookListItems(user.id);

  return json({
    ownerName: `${user.firstname} ${user.surname}`,
    bookListItems,
    bookCount: bookListItems.length,
    sampleTitles: bookListItems.slice(0, 3).map((book) => book.title),
    // Link previews need absolute URLs
    origin: publicOrigin(request),
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
