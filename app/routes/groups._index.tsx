import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useNavigation } from "@remix-run/react";

import Faces from "~/components/faces";
import FriendsTabs from "~/components/friends-tabs";
import Layout from "~/components / Layout/Layout";
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
  return json({ groups, counts, nameMax: GROUP_NAME_MAX, maxMembers: GROUP_MAX_MEMBERS });
};

// A new group, and straight to it to invite people
export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const name = cleanGroupName((await request.formData()).get("name"));
  if (!name) return json({ error: "Give the group a name." }, { status: 400 });
  const group = await createGroup(userId, name);
  return redirect(groupPath({ id: group.id, name }));
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function Groups() {
  const { groups, counts, nameMax, maxMembers } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const creating = useNavigation().formMethod === "POST";

  return (
    <Layout title="Groups" header={<FriendsTabs counts={counts} />}>
      <section>
        <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
          Your groups
          {groups.length ? (
            <span className="ml-2 font-normal text-stone-400 dark:text-stone-500">{groups.length}</span>
          ) : null}
        </h2>
        {groups.length > 0 ? (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
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
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 px-6 py-10 text-center">
            <p className="font-medium text-stone-900 dark:text-stone-100">No groups yet</p>
            <p className="mx-auto mt-1 max-w-md text-stone-500 dark:text-stone-400">
              Start one for a book club, an office or a family, or ask someone in a group for its
              link.
            </p>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">Start a group</h2>
        <p className="mt-1 max-w-xl text-stone-500 dark:text-stone-400">
          You&apos;ll get a link to share. Everyone who joins from it becomes friends with
          everyone else, so all their shelves open up at once. Up to {maxMembers} people.
        </p>
        <Form method="post" className="mt-4 flex max-w-xl gap-2">
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
            className="flex-shrink-0 rounded-md bg-forest-600 px-4 py-2 text-sm font-medium text-white hover:bg-forest-700 transition-colors disabled:opacity-60"
          >
            {creating ? "Starting…" : "Start a group"}
          </button>
        </Form>
        {actionData?.error ? (
          <p id="group-error" className="mt-2 text-sm text-rose-700 dark:text-rose-400">
            {actionData.error}
          </p>
        ) : null}
      </section>
    </Layout>
  );
}
