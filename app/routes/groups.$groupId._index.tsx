import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useRouteLoaderData } from "@remix-run/react";

import PooledShelf from "~/components/pooled-shelf";
import { loadGroup } from "~/group-page.server";
import { loadPooledShelf } from "~/pooled-shelf.server";

import type { GroupLayoutData } from "./groups.$groupId";

// The group's Shelf tab: everyone else's books as one shelf

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { userId, group } = await loadGroup(request, params);
  const lenders = group.members.filter((member) => member.isFriend);
  return json(await loadPooledShelf(request, userId, group.openIds, lenders));
};

export default function GroupShelf() {
  const data = useLoaderData<typeof loader>();
  const layout = useRouteLoaderData<GroupLayoutData>("routes/groups.$groupId");
  return (
    <PooledShelf
      data={data}
      empty={
        <>
          <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">No books to borrow yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-stone-500 dark:text-stone-400">
            Once people join {layout?.group.name ?? "the group"}, their books show up here. Invite
            them with the button above.
          </p>
        </>
      }
    />
  );
}
