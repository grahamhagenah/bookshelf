
import { data, useLoaderData, useRouteLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import EmptyList from "~/components/empty-list";
import { BookIcon } from "~/components/icons";
import InviteMessage from "~/components/invite-message";
import PooledShelf from "~/components/pooled-shelf";
import { groupInviteText } from "~/group-links";
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
          <EmptyList
            icon={<BookIcon size={28} />}
            title={
              (layout?.group.myBookCount ?? 0) > 0
                ? "No one else has added books yet"
                : "No one\u2019s added books yet"
            }
            action={
              (layout?.group.myBookCount ?? 0) > 0
                ? undefined
                : { to: "/search", label: "Add books", plus: true }
            }
            className="mt-2"
          >
            {(layout?.group.myBookCount ?? 0) > 0
              ? "Yours are in it already. Everyone else's show up here as they add them."
              : `Add yours, and everyone in ${layout?.group.name ?? "the group"} can borrow them. Their books show up here as they add them.`}
          </EmptyList>
        ) : (
          <EmptyList
            icon={<BookIcon size={28} />}
            title="No books to borrow yet"
            // The message to send them, ready to go
            action={
              layout ? (
                <InviteMessage
                  url={layout.inviteUrl}
                  title="Invite them"
                  intro="Send this to the group. Whoever joins from the link is friends with everyone in it."
                  text={groupInviteText(layout.group.name, layout.inviteUrl)}
                  subject={`Join ${layout.group.name} on Stacks`}
                  className="mx-auto mt-2 max-w-md text-left"
                />
              ) : undefined
            }
            className="mt-2"
          >
            Once people join {layout?.group.name ?? "the group"}, their books show up here.
          </EmptyList>
        )
      }
    />
  );
}
