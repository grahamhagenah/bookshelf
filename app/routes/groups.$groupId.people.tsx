import { useEffect, useState } from "react";
import { data, Form, Link, useFetcher, useRouteLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import Avatar from "~/components/avatar";
import CopyButton from "~/components/copy-button";
import { mailtoInvite } from "~/components/invite-message";
import { quietButton, sectionHeading } from "~/components/ui";
import { groupInviteText } from "~/group-links";
import { loadGroup } from "~/group-page.server";
import type { LoaderData } from "~/utils";

import type { GroupLayoutData } from "./groups.$groupId";

// Who's in the group (for whoever runs it, with the way to take someone
// out), and beside them the link that brings more people in, then the
// way out of the group. Renaming is beside the name at the top.

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  await loadGroup(request, params);
  return data({});
};

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

export default function GroupPeople() {
  const layout = useRouteLoaderData<GroupLayoutData>("routes/groups.$groupId");
  if (!layout) return null;
  const { group, path, inviteUrl } = layout;
  const iRunIt = group.members.some((member) => member.isMe && member.isOwner);

  return (
    // As the Friends page: the people across most of the width, and a
    // narrow side column that stays in view
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,16rem)] lg:gap-x-14">
      <section aria-labelledby="people">
        <h2 id="people" className="sr-only">People</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {group.members.map((member) => (
            <PersonCard
              key={member.id}
              member={member}
              groupName={group.name}
              path={path}
              canRemove={iRunIt ? !member.isMe : false}
            />
          ))}
        </ul>
      </section>

      <aside className="self-start lg:sticky lg:top-24">
        <GroupInvite name={group.name} url={inviteUrl} alone={group.members.length === 1} path={path} />
        <LeaveOrDelete name={group.name} path={path} runIt={iRunIt} />
      </aside>
    </div>
  );
}

type Member = NonNullable<LoaderData<GroupLayoutData>>["group"]["members"][number];

// One person: who they are and how many books they bring, opening their
// shelf (being in the group is enough). On someone who isn't your friend
// yet, a way to become one; for whoever runs the group, the way to take
// them out, which asks first.
function PersonCard({
  member,
  groupName,
  path,
  canRemove,
}: {
  member: Member;
  groupName: string;
  path: string;
  canRemove: boolean;
}) {
  const fetcher = useFetcher();
  const befriend = useFetcher<{ success?: boolean }>();
  const busy = fetcher.state !== "idle";
  const asked = befriend.formData !== undefined || befriend.data?.success === true;
  const who = (
    <>
      <Avatar firstname={member.firstname} surname={member.surname} icon={member.profileEmoji} />
      <span className="min-w-0">
        <span className="block truncate font-medium text-stone-900 dark:text-stone-100">
          {member.firstname} {member.surname}
          {member.isMe ? <span className="font-normal text-stone-500 dark:text-stone-400"> (you)</span> : null}
        </span>
        <span className="block truncate text-sm text-stone-500 dark:text-stone-400">
          {plural(member.bookCount, "book")}
          {member.isOwner ? " · started it" : ""}
        </span>
      </span>
    </>
  );
  // Taking someone out, for whoever runs it. Leaving and ending the group
  // are in the side column
  const actions = canRemove
    ? [
        {
          label: "Remove",
          intent: "remove",
          ask: `Remove ${member.firstname} from ${groupName}? Their shelf and the group's close to each other, except between friends. They can rejoin if they still have the invite link, so reset it if you need to.`,
        },
      ]
    : [];

  return (
    <li
      className={`flex items-center gap-3 rounded-xl border border-stone-200 dark:border-stone-800 p-3 transition-opacity ${
        busy ? "opacity-40" : ""
      }`}
    >
      {member.isMe ? (
        <span className="flex min-w-0 flex-1 items-center gap-3">{who}</span>
      ) : (
        <Link to={`/friend/${member.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80 transition-opacity">
          {who}
        </Link>
      )}
      {!member.isMe && !member.isFriend ? (
        asked ? (
          <span className="flex-shrink-0 whitespace-nowrap px-2 py-1 text-sm text-stone-400 dark:text-stone-500">
            Requested
          </span>
        ) : (
          <befriend.Form method="post" action="/friends/add" className="flex-shrink-0">
            <input type="hidden" name="friendId" value={member.id} />
            <button
              type="submit"
              className="whitespace-nowrap rounded-md px-2 py-1 text-sm text-stone-500 dark:text-stone-400 hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-stone-800 dark:hover:text-stone-100 transition-colors"
            >
              Add friend
            </button>
          </befriend.Form>
        )
      ) : null}
      {actions.length > 0 ? (
        <div className="flex flex-shrink-0 items-center">
          {actions.map((action) => (
            <fetcher.Form
              key={action.intent}
              method="post"
              action={path}
              onSubmit={(event) => {
                if (!confirm(action.ask)) event.preventDefault();
              }}
            >
              <input type="hidden" name="intent" value={action.intent} />
              <input type="hidden" name="memberId" value={member.id} />
              <button
                type="submit"
                disabled={busy}
                className="whitespace-nowrap rounded-md px-2 py-1 text-sm text-stone-500 dark:text-stone-400 hover:bg-stone-100 hover:text-rose-700 dark:hover:bg-stone-800 dark:hover:text-rose-400 transition-colors"
              >
                {action.label}
              </button>
            </fetcher.Form>
          ))}
        </div>
      ) : null}
    </li>
  );
}

// The link that brings people in: copy it, or send it from your phone or
// email. Resetting it is for a link that's gone further than it should,
// so it asks first.
function GroupInvite({ name, url, alone, path }: { name: string; url: string; alone: boolean; path: string }) {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator.share === "function"), []);
  const subject = `Join ${name} on Stacks`;
  const text = groupInviteText(name, url);
  // Two answers side by side across the column, as the Friends sidebar's
  // requests are
  const half = "inline-flex h-8 flex-1 items-center justify-center rounded-md text-sm transition-colors";
  const primary = `${half} bg-forest-600 font-medium text-white hover:bg-forest-700`;
  return (
    <section aria-labelledby="invite">
      <h2 id="invite" className={sectionHeading}>
        {alone ? "Invite people" : "Invite more people"}
      </h2>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        Anyone with the link can join, and see and borrow from everyone&apos;s shelf here.
      </p>
      <input
        type="text"
        readOnly
        value={url.replace(/^https?:\/\//, "")}
        aria-label="Invite link"
        onFocus={(event) => event.currentTarget.select()}
        className="mt-3 w-full rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3 py-1.5 text-sm text-stone-600 dark:text-stone-300"
      />
      <div className="mt-2 flex gap-2">
        <CopyButton
          value={url}
          label="Copy link"
          className={`${half} border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500`}
        />
        {canShare ? (
          <button
            type="button"
            onClick={() => navigator.share({ title: subject, text }).catch(() => undefined)}
            className={primary}
          >
            Share
          </button>
        ) : (
          <a href={mailtoInvite(url, [], text, subject)} className={primary}>
            Email
          </a>
        )}
      </div>
      <Form
        method="post"
        action={path}
        className="mt-3"
        onSubmit={(event) => {
          if (!confirm("Reset the invite link? The current one will stop working, so only people you send the new one to can join.")) {
            event.preventDefault();
          }
        }}
      >
        <button
          type="submit"
          name="intent"
          value="resetLink"
          className="text-xs text-stone-500 dark:text-stone-400 underline-offset-4 hover:underline hover:text-stone-800 dark:hover:text-stone-200"
        >
          Reset link
        </button>
      </Form>
    </section>
  );
}

// Leaving the group, and for whoever runs it, ending it for everyone.
// Rarely wanted, so quiet, under the invite; both ask first.
function LeaveOrDelete({ name, path, runIt }: { name: string; path: string; runIt: boolean }) {
  const choices = [
    {
      label: "Leave group",
      intent: "leave",
      ask: `Leave ${name}? Its members' shelves close to you, and yours to them, except for anyone you've become friends with.`,
    },
    ...(runIt
      ? [
          {
            label: "Delete group",
            intent: "delete",
            ask: `Delete ${name} for everyone? Everyone keeps their books and their friends; the group's shelves close to each other, and its page and invite link stop working.`,
          },
        ]
      : []),
  ];
  return (
    <div className="mt-8 flex flex-wrap gap-2 border-t border-stone-200 dark:border-stone-800 pt-6">
      {choices.map((choice) => (
        <Form
          key={choice.intent}
          method="post"
          action={path}
          onSubmit={(event) => {
            if (!confirm(choice.ask)) event.preventDefault();
          }}
        >
          <button
            type="submit"
            name="intent"
            value={choice.intent}
            className={`${quietButton("md")} hover:text-rose-700 dark:hover:text-rose-400`}
          >
            {choice.label}
          </button>
        </Form>
      ))}
    </div>
  );
}
