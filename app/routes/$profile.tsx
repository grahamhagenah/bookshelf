
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

import SharedShelf, { shelfSummary } from "~/components/shared-shelf";
import { getUserByHandle } from "~/profile.server";
import { seo } from "~/seo";
import { loadSharedShelf } from "~/share.server";

// A shelf at its own address, bookstacks.app/@handle. Only addresses that
// start with @ land here, and only while the owner's sharing is on.

export const meta: MetaFunction<typeof loader> = ({ loaderData, params }) =>
  seo({
    title: loaderData?.ownerName ? `${loaderData.ownerName}'s bookshelf` : "Bookshelf",
    description: loaderData
      ? (loaderData.profile.bio ?? shelfSummary(loaderData.ownerName, loaderData.bookCount, loaderData.sampleTitles))
      : undefined,
    path: `/${params.profile}`,
    image: loaderData ? `${loaderData.origin}/share/${loaderData.shareToken}/preview.png` : undefined,
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
  const segment = params.profile ?? "";
  if (!segment.startsWith("@")) throw new Response("Not Found", { status: 404 });
  const owner = await getUserByHandle(segment.slice(1));
  if (!owner?.shareToken) throw new Response("Not Found", { status: 404 });
  return loadSharedShelf(request, { id: owner.id, shareToken: owner.shareToken });
};

export default function ProfileShelf() {
  return <SharedShelf data={useLoaderData<typeof loader>()} />;
}
