
import { data, Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

import EmptyList from "~/components/empty-list";
import Faces from "~/components/faces";
import FriendsTabs from "~/components/friends-tabs";
import { GroupsIcon } from "~/components/icons";
import Layout from "~/components/layout";
import { primaryButton, sectionHeading } from "~/components/ui";
import { getFriendsTabCounts } from "~/friends-tabs.server";
import { groupPath } from "~/group-links";
import {
  GROUP_MAX_MEMBERS,
  GROUP_NAME_MAX,
  cleanGroupName,
  createGroup,
  getMyGroups,
} from "~/models/group.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";

// Every group you're in, and where to start one: a book club, an office,
// a family, where everyone can borrow from everyone. A tab of Friends,
// since a group is a way of being friends with a bunch of people at once.

export const meta: MetaFunction = () => seo({ title: "Groups", noindex: true });

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const [groups, counts] = await Promise.all([getMyGroups(userId), getFriendsTabCounts(userId)]);
  return data({ groups, counts, nameMax: GROUP_NAME_MAX, maxMembers: GROUP_MAX_MEMBERS });
};

// A new group, and straight to it to invite people
export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const name = cleanGroupName((await request.formData()).get("name"));
  if (!name) return data({ error: "Give the group a name." }, { status: 400 });
  const group = await createGroup(userId, name);
  return redirect(groupPath({ id: group.id, name }));
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function Groups() {
  const { groups, counts, nameMax, maxMembers } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const creating = useNavigation().formMethod === "POST";

  // Naming a new group: under your groups, or in the empty state's place
  const startForm = (className: string) => (
    <div className={className}>
      <Form method="post" className="flex gap-2">
        <input
          name="name"
          required
          maxLength={nameMax}
          autoComplete="off"
          placeholder="Office book swap"
          aria-label="Group name"
          aria-describedby="group-error"
          className="min-w-0 flex-1 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10 transition-colors"
        />
        <button
          type="submit"
          disabled={creating}
          className={`${primaryButton("lg")} flex-shrink-0 disabled:opacity-60`}
        >
          {creating ? "Starting…" : "Start a group"}
        </button>
      </Form>
      {actionData?.error ? (
        <p id="group-error" className="mt-2 text-sm text-rose-700 dark:text-rose-400">
          {actionData.error}
        </p>
      ) : null}
    </div>
  );

  return (
    <Layout title="Groups" header={<FriendsTabs counts={counts} />}>
      {groups.length > 0 ? (
        // Your groups on the left, starting another beside them
        <div className="grid gap-10 md:grid-cols-2 md:gap-14">
          <section>
            {/* The tab above already says how many */}
            <h2 className="sr-only">Your groups</h2>
            <ul className="grid gap-3">
              {groups.map((group) => (
                <li key={group.id}>
                  <Link
                    to={groupPath(group)}
                    className="flex items-center gap-4 rounded-xl border border-stone-200 dark:border-stone-800 p-4 hover:border-stone-400 dark:hover:border-stone-600 transition-colors"
                  >
                    <Faces people={group.faces} max={3} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-stone-900 dark:text-stone-100">
                        {group.name}
                      </span>
                      <span className="block text-sm text-stone-500 dark:text-stone-400">
                        {plural(group.memberCount, "person", "people")} ·{" "}
                        {plural(group.bookCount, "book", "books")}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className={sectionHeading}>Start a group</h2>
            <p className="mt-1 max-w-xl text-stone-500 dark:text-stone-400">
              You&apos;ll get a link to share. Everyone who joins from it becomes friends with
              everyone else, so all their shelves open up at once. Up to {maxMembers} people.
            </p>
            {startForm("mt-4")}
          </section>
        </div>
      ) : (
        // None yet: what a group is for, with the way to start one in it
        <EmptyList
          icon={<GroupsIcon size={28} />}
          title="No groups yet"
          action={startForm("w-full max-w-md")}
          className="mt-2"
        >
          Start one for a book club, an office or a family: you&apos;ll get a link to share,
          and everyone who joins can borrow from everyone else, up to {maxMembers} people. Or
          ask someone in a group for its link.
        </EmptyList>
      )}
    </Layout>
  );
}
