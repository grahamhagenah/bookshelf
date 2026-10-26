import type { LoaderFunctionArgs, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useFetcher, useRouteLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";

import Avatar from "~/components/avatar";
import CopyButton from "~/components/copy-button";
import { mailtoInvite } from "~/components/invite-message";
import { sectionHeading } from "~/components/ui";
import { loadGroup } from "~/group-page.server";

import type { GroupLayoutData } from "./groups.$groupId";

// Who's in the group, each with the way out (your own) or, for whoever
// runs the group, the way to take them out, and the link that brings
// more people in. Renaming is beside the name at the top.

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  await loadGroup(request, params);
  return json({});
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
      </aside>
    </div>
  );
}

type Member = NonNullable<SerializeFrom<GroupLayoutData>>["group"]["members"][number];

// One person: who they are and how many books they bring, opening their
// shelf. On your own card, the way out (and, for whoever runs the group,
// the way to end it); on others', for whoever runs it, the way to take
// them out. Each asks first.
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
  const busy = fetcher.state !== "idle";
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
  // What this card lets you do: leave (and, if you run it, end the group)
  // on your own; take someone out on theirs, if you run it
  const actions = [
    ...(member.isMe
      ? [
          {
            label: "Leave",
            intent: "leave",
            ask: `Leave ${groupName}? You'll stay friends with the people you met here, and can remove friends on the Friends page.`,
          },
        ]
      : []),
    ...(member.isMe && member.isOwner
      ? [
          {
            label: "Delete group",
            intent: "delete",
            ask: `Delete ${groupName} for everyone? Everyone stays friends and keeps their books; the group's page and invite link stop working.`,
          },
        ]
      : []),
    ...(canRemove
      ? [
          {
            label: "Remove",
            intent: "remove",
            ask: `Remove ${member.firstname} from ${groupName}? You'll stay friends. They can rejoin if they still have the invite link, so reset it if you need to.`,
          },
        ]
      : []),
  ];

  return (
    <li
      className={`flex items-center gap-3 rounded-xl border border-stone-200 dark:border-stone-800 p-3 transition-opacity ${
        busy ? "opacity-40" : ""
      }`}
    >
      {member.isFriend ? (
        <Link to={`/friend/${member.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-80 transition-opacity">
          {who}
        </Link>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-3">{who}</span>
      )}
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
  const text = `Join ${name} on Stacks, so we can borrow each other's books: ${url}`;
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
        Anyone with the link can join, and becomes friends with everyone here.
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
