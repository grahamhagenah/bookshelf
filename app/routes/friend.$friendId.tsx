import { data, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import invariant from "tiny-invariant";

import Library from "~/components/library";
import { getBookListItems } from "~/models/book.server";
import { circleOf } from "~/models/circle.server";
import { shelfIds } from "~/models/household.server";
import { getLoveCounts } from "~/models/note.server";
import { getUserById } from "~/models/user.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";

interface LoaderData {
  friendName: string;
}

export const meta: MetaFunction<typeof loader> = ({ loaderData }) =>
  seo({
    title: loaderData?.friendName ? `${loaderData.friendName}'s shelf` : "Shelf",
    noindex: true,
  });

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

  // Only someone in your circle: a friend, or someone in one of your
  // groups, who shows you their shelf without what they keep off their page
  const circle = await circleOf(currentUserId);
  const isFriend = circle.friends.has(params.friendId);
  if (!isFriend && !circle.groupOnly.has(params.friendId)) {
    throw new Response("Not Found", { status: 404 });
  }

  // Their shelf includes their household's books
  const shelf = await getBookListItems(await shelfIds(user.id));
  const books = isFriend ? shelf : shelf.filter((book) => !book.hiddenFromPage);
  const loveCounts = await getLoveCounts(books.map((book) => book.id));
  const bookListItems = books.map((book) => ({
    ...book,
    loveCount: loveCounts.get(book.id) ?? 0,
  }));

  return data({
    user,
    friendName: `${user.firstname} ${user.surname}`,
    bookListItems,
  });
};

export default function FriendsBookPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <>
      <Library bookListItems={data.bookListItems} ownerName={data.friendName} />
    </>
  );
}
