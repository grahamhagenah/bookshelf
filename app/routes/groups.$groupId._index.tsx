
import { data, Link, useLoaderData, useRouteLoaderData } from "react-router";
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
        // Before anyone's joined, ask for people; after, for books
        (layout?.group.members.length ?? 0) > 1 ? (
          <>
            <h2 className={sectionHeading}>
              {(layout?.group.myBookCount ?? 0) > 0
                ? "No one else has added books yet"
                : "No one\u2019s added books yet"}
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-stone-500 dark:text-stone-400">
              {(layout?.group.myBookCount ?? 0) > 0
                ? "Yours are in it already. Everyone else's show up here as they add them."
                : `Add yours, and everyone in ${layout?.group.name ?? "the group"} can borrow them. Their books show up here as they add them.`}
            </p>
            <Link
              to="/search"
              className="mt-4 inline-flex h-8 items-center rounded-md border border-stone-200 dark:border-stone-700 px-3 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors"
            >
              Add books
            </Link>
          </>
        ) : (
          <>
            <h2 className={sectionHeading}>No books to borrow yet</h2>
            <p className="mx-auto mt-1 max-w-sm text-stone-500 dark:text-stone-400">
              Once people join {layout?.group.name ?? "the group"}, their books show up here. Invite
              them with the button above.
            </p>
          </>
        )
      }
    />
  );
}
