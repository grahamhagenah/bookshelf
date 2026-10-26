import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation, useSearchParams } from "@remix-run/react";
import { useState } from "react";
import invariant from "tiny-invariant";

import Avatar from "~/components/avatar";
import BookCover from "~/components/book-cover";
import InviteMessage from "~/components/invite-message";
import Layout from "~/components / Layout/Layout";
import {
  GROUP_MAX_MEMBERS,
  GROUP_NAME_MAX,
  cleanGroupName,
  getGroup,
  leaveGroup,
  renameGroup,
  resetGroupLink,
} from "~/models/group.server";
import { publicOrigin } from "~/origin.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";

// A group's own page, for the people in it: everyone's books on one shelf,
// who's in it, and the link that brings more people in

export const meta: MetaFunction<typeof loader> = ({ data }) =>
  seo({ title: data?.group.name ?? "Group", noindex: true });

export const handle = {
  breadcrumbs: (data: { group?: { name: string } } | undefined) => [
    { label: "Groups", href: "/groups" },
    { label: data?.group?.name ?? "Group" },
  ],
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  invariant(params.groupId, "groupId not found");
  const group = await getGroup(params.groupId, userId);
  if (!group) throw new Response("Not Found", { status: 404 });
  const { inviteToken, ...rest } = group;
  return json({
    group: rest,
    inviteUrl: `${publicOrigin(request)}/g/${inviteToken}`,
    maxMembers: GROUP_MAX_MEMBERS,
    nameMax: GROUP_NAME_MAX,
  });
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  invariant(params.groupId, "groupId not found");
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent === "leave") {
    await leaveGroup(userId, params.groupId);
    return redirect("/groups");
  }
  if (intent === "rename") {
    const name = cleanGroupName(formData.get("name"));
    if (!name) return json({ error: "Give the group a name." }, { status: 400 });
    await renameGroup(userId, params.groupId, name);
    return json({ ok: true });
  }
  if (intent === "resetLink") {
    await resetGroupLink(userId, params.groupId);
    return json({ ok: true });
  }
  return json({ error: "Unknown request" }, { status: 400 });
};

const quietButton =
  "rounded-md border border-stone-200 dark:border-stone-700 px-3 py-1.5 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors disabled:opacity-50";
const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

export default function GroupPage() {
  const { group, inviteUrl, maxMembers, nameMax } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const justJoined = searchParams.get("joined") === "1";
  const others = group.members.filter((member) => !member.isMe);
  const [renaming, setRenaming] = useState(false);
  const navigation = useNavigation();
  const busy = navigation.state !== "idle";

  return (
    <Layout
      title={group.name}
      aside={
        <aside aria-labelledby="members" className="mt-10 lg:mt-0">
          <h2 id="members" className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            {group.members.length} {group.members.length === 1 ? "person" : "people"}
          </h2>
          <ul className="mt-3 space-y-3">
            {group.members.map((member) => {
              const inner = (
                <>
                  <Avatar
                    firstname={member.firstname}
                    surname={member.surname}
                    icon={member.profileEmoji}
                    size="sm"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                      {member.firstname} {member.surname}
                      {member.isMe ? (
                        <span className="font-normal text-stone-500 dark:text-stone-400"> (you)</span>
                      ) : null}
                    </span>
                    <span className="block text-xs text-stone-500 dark:text-stone-400">
                      {plural(member.bookCount, "book")}
                    </span>
                  </span>
                </>
              );
              return (
                <li key={member.id}>
                  {member.isFriend ? (
                    <Link
                      to={`/friend/${member.id}`}
                      className="flex items-center gap-3 rounded-md hover:opacity-80 transition-opacity"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-3">{inner}</span>
                  )}
                </li>
              );
            })}
          </ul>
          <Form method="post" className="mt-8">
            <LeaveButton />
          </Form>
        </aside>
      }
    >
      <section>
        {justJoined ? (
          <p
            role="status"
            className="mb-6 rounded-lg bg-stone-100 dark:bg-stone-900 px-4 py-3 text-sm text-stone-700 dark:text-stone-200"
          >
            You&apos;re in. You and everyone in {group.name} are friends now, so you can
            borrow from each other&apos;s shelves.
          </p>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-3">
          {renaming ? (
            <Form method="post" className="flex w-full max-w-md gap-2" onSubmit={() => setRenaming(false)}>
              <input type="hidden" name="intent" value="rename" />
              <input
                name="name"
                defaultValue={group.name}
                maxLength={nameMax}
                required
                aria-label="Group name"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                className="min-w-0 flex-1 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-1.5 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10"
              />
              <button type="submit" className={quietButton}>
                Save
              </button>
            </Form>
          ) : (
            <div>
              <p className="text-2xl font-semibold text-stone-900 dark:text-stone-100">{group.name}</p>
              <p className="mt-1 text-stone-500 dark:text-stone-400">
                {plural(group.bookCount, "book")} on {group.members.length === 1 ? "your shelf" : "everyone's shelves"}
              </p>
            </div>
          )}
          {!renaming ? (
            <button type="button" onClick={() => setRenaming(true)} className={quietButton}>
              Rename
            </button>
          ) : null}
        </div>

        {group.books.length > 0 ? (
          <>
            <ul className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
              {group.books.map((book) => (
                <li key={book.id}>
                  <Link to={`/books/${book.id}`} title={book.title} className="block hover:opacity-90 transition-opacity">
                    <BookCover
                      cover={book.cover}
                      title={book.title}
                      author={book.author}
                      className="w-full aspect-[2/3]"
                    />
                    <span className="mt-1.5 block truncate text-xs text-stone-700 dark:text-stone-300">
                      {book.title}
                    </span>
                    <span className="block truncate text-xs text-stone-500 dark:text-stone-400">
                      {book.user.firstname}
                      {book.borrowerId ? " · lent out" : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            {group.bookCount > group.books.length ? (
              <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">
                The newest {group.books.length}. Open someone&apos;s shelf to see all of theirs.
              </p>
            ) : null}
          </>
        ) : (
          <p className="mt-6 text-stone-500 dark:text-stone-400">
            No books here yet. Once people join and add theirs, they&apos;ll show up here.
          </p>
        )}
      </section>

      <section>
        <InviteMessage
          url={inviteUrl}
          title={others.length === 0 ? "Invite people to the group" : "Invite more people"}
          intro={`Anyone with this link can join, up to ${maxMembers} people. They'll be friends with everyone in the group straight away.`}
          text={`Join ${group.name} on Stacks, so we can borrow each other's books: ${inviteUrl}`}
          subject={`Join ${group.name} on Stacks`}
        />
        <Form method="post" className="mt-3">
          <input type="hidden" name="intent" value="resetLink" />
          <button
            type="submit"
            disabled={busy}
            className="text-sm text-stone-500 dark:text-stone-400 underline-offset-4 hover:underline hover:text-stone-800 dark:hover:text-stone-200"
          >
            Make a new link (the old one stops working)
          </button>
        </Form>
      </section>
    </Layout>
  );
}

// Two clicks: the first says what leaving means, the second leaves
function LeaveButton() {
  const [armed, setArmed] = useState(false);
  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className={quietButton}>
        Leave group
      </button>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-stone-600 dark:text-stone-300">
        You&apos;ll stay friends with the people you met here. You can remove friends on the
        Friends page.
      </p>
      <div className="flex gap-2">
        <button type="submit" name="intent" value="leave" className={quietButton}>
          Leave
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          className="px-2 text-sm text-stone-500 dark:text-stone-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
