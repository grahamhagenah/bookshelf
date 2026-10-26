
import { data, useLoaderData, useRouteLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import PooledShelf from "~/components/pooled-shelf";
import { sectionHeading } from "~/components/ui";
import { loadGroup } from "~/group-page.server";
import { loadPooledShelf } from "~/pooled-shelf.server";

import type { GroupLayoutData } from "./groups.$groupId";

// A group's page opens on its books: the same shelf as the Friends page's
// Books tab, narrowed to the people in the group, so you can browse them
// without leaving it

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { userId, group } = await loadGroup(request, params);
  const lenders = group.members.filter((member) => member.isFriend);
  return data(await loadPooledShelf(request, userId, group.openIds, { lenders }));
};

export default function GroupBooks() {
  const data = useLoaderData<typeof loader>();
  const layout = useRouteLoaderData<GroupLayoutData>("routes/groups.$groupId");
  return (
    <PooledShelf
      data={data}
      empty={
        <>
          <h2 className={sectionHeading}>No books to borrow yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-stone-500 dark:text-stone-400">
            Once people join {layout?.group.name ?? "the group"}, their books show up here. Invite
            them with the button above.
          </p>
        </>
      }
    />
  );
}
