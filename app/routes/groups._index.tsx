
import { data, Form, Link, redirect, useActionData, useLoaderData, useNavigation } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

import BookCover from "~/components/book-cover";
import EmptyList from "~/components/empty-list";
import Faces from "~/components/faces";
import FriendsTabs from "~/components/friends-tabs";
import { BookIcon, ClockIcon, GroupIcon, GroupsIcon } from "~/components/icons";
import Layout from "~/components/layout";
import { primaryButton, sectionHeading } from "~/components/ui";
import { getFriendsTabCounts } from "~/friends-tabs.server";
import { groupPath } from "~/group-links";
import {
  GROUP_MAX_MEMBERS,
  GROUP_NAME_MAX,
  cleanGroupName,
  createGroup,
  getGroupPreviews,
} from "~/models/group.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";
import { agoInWords, type LoaderData } from "~/utils";

// Every group you're in, and where to start one: a book club, an office,
// a family, where everyone can borrow from everyone. A tab of Friends,
// since a group is a way of being friends with a bunch of people at once.

export const meta: MetaFunction = () => seo({ title: "Groups", noindex: true });

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const [groups, counts] = await Promise.all([getGroupPreviews(userId), getFriendsTabCounts(userId)]);
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

type Group = LoaderData<typeof loader>["groups"][number];

const monthYear = (date: string | Date) =>
  new Date(date).toLocaleDateString("en-US", { month: "short", year: "numeric" });

// A group, built as the Friends page's friend card is: who it is, the
// newest covers on its shelves, a few plain facts, and the way in
function GroupCard({ group }: { group: Group }) {
  const page = groupPath(group);
  // Five slots: the newest covers, the last one saying how many more
  const covers = group.bookCount > 5 ? group.newest.slice(0, 4) : group.newest;
  const more = group.bookCount - covers.length;
  return (
    <li className="flex flex-col rounded-xl border border-stone-200 dark:border-stone-800 p-4">
      <div className="flex items-center gap-3">
        <Link to={page} tabIndex={-1} aria-hidden="true" className="flex-shrink-0">
          <Faces people={group.faces} max={3} />
        </Link>
        <div className="min-w-0">
          <Link
            to={page}
            className="block truncate font-semibold text-stone-900 dark:text-stone-100 hover:underline underline-offset-2"
          >
            {group.name}
          </Link>
          <p className="truncate text-sm text-stone-500 dark:text-stone-400">
            {[
              plural(group.memberCount, "person", "people"),
              group.joinedAt ? `Joined ${monthYear(group.joinedAt)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      {covers.length > 0 ? (
        <ul className="mt-4 grid grid-cols-5 gap-2" aria-label={`Newest in ${group.name}`}>
          {covers.map((book) => (
            <li key={book.id}>
              <Link
                to={`/books/${book.id}`}
                title={book.title}
                className="block hover:opacity-90 transition-opacity"
              >
                <BookCover
                  cover={book.cover}
                  title={book.title}
                  author={book.author}
                  alt={book.title}
                  className="aspect-[2/3]"
                />
              </Link>
            </li>
          ))}
          {more > 0 ? (
            <li>
              <Link
                to={page}
                aria-label={`${more} more in ${group.name}`}
                className="flex aspect-[2/3] items-center justify-center rounded-xs bg-stone-50 dark:bg-stone-900 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              >
                +{more}
              </Link>
            </li>
          ) : null}
        </ul>
      ) : null}

      <ul className="mt-4 mb-4 space-y-1.5 text-sm text-stone-600 dark:text-stone-300 [&_svg]:flex-shrink-0 [&_svg]:text-stone-400 dark:[&_svg]:text-stone-500">
        <li className="flex items-center gap-2">
          <BookIcon size={14} />
          {group.bookCount
            ? `${plural(group.bookCount, "book", "books")} between them`
            : "No books on their shelves yet"}
        </li>
        <li className="flex min-w-0 items-center gap-2">
          <GroupIcon size={14} />
          <span className="truncate">{whoIsIn(group.names)}</span>
        </li>
        {group.newest[0] ? (
          <li className="flex items-center gap-2">
            <ClockIcon size={14} />
            Last added a book {agoInWords(group.newest[0].createdAt)}
          </li>
        ) : null}
      </ul>

      <div className="mt-auto border-t border-stone-100 dark:border-stone-800 pt-3">
        <Link
          to={page}
          className="text-sm font-medium text-stone-800 dark:text-stone-200 hover:text-stone-950 dark:hover:text-white"
        >
          See the group →
        </Link>
      </div>
    </li>
  );
}

// "You, Maya and Sam", "You, Maya, Sam and 4 others"
function whoIsIn(names: string[]) {
  if (names.length <= 1) return "Just you so far";
  const shown = names.length > 4 ? names.slice(0, 3) : names.slice(0, -1);
  const rest = names.length > 4 ? `${names.length - 3} others` : names[names.length - 1];
  return `${shown.join(", ")} and ${rest}`;
}

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
            <ul className="grid gap-4">
              {groups.map((group) => (
                <GroupCard key={group.id} group={group} />
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
