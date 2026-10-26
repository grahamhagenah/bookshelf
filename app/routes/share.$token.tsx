import { redirect, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import invariant from "tiny-invariant";

import SharedShelf, { shelfSummary } from "~/components/shared-shelf";
import { getUserByShareToken } from "~/models/user.server";
import { seo } from "~/seo";
import { askToBeFriends, loadSharedShelf } from "~/share.server";

// A shelf shared by its private link. With a handle set, the link moves on
// to the shelf's own address, bookstacks.app/@handle.

// What iMessage, Slack and friends show when the link is pasted
export const meta: MetaFunction<typeof loader> = ({ data, params }) =>
  seo({
    title: data?.ownerName ? `${data.ownerName}'s bookshelf` : "Bookshelf",
    description: data ? shelfSummary(data.ownerName, data.bookCount, data.sampleTitles) : undefined,
    path: `/share/${params.token}`,
    image: data ? `${data.origin}/share/${params.token}/preview.png` : undefined,
    noindex: true,
  });

export const handle = {
  // Shown like its own website: no app header, just the shelf and footer
  standalone: true,
  breadcrumb: (data: { ownerName?: string } | undefined) => (
    <span>{data?.ownerName ? `${data.ownerName}'s shelf` : "Shelf"}</span>
  ),
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  invariant(params.token, "token not found");
  const user = await getUserByShareToken(params.token);
  if (!user) throw new Response("Not Found", { status: 404 });
  if (user.handle) return redirect(`/@${user.handle}`);
  return loadSharedShelf(request, { id: user.id, shareToken: params.token });
};

// The Add friend button posts here from either address
export const action = async ({ params, request }: ActionFunctionArgs) => {
  const owner = params.token ? await getUserByShareToken(params.token) : null;
  if (!owner) throw new Response("Not Found", { status: 404 });
  return askToBeFriends(request, owner.id);
};

export default function PublicSharePage() {
  return <SharedShelf data={useLoaderData<typeof loader>()} />;
}
