import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData, useRouteLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";

import Avatar from "~/components/avatar";
import CopyButton from "~/components/copy-button";
import { mailtoInvite } from "~/components/invite-message";
import { loadGroup } from "~/group-page.server";
import { GROUP_NAME_MAX } from "~/models/group.server";

import type { GroupLayoutData } from "./groups.$groupId";

// Who's in the group, the link that brings more people in, and the
// group's name and the way out

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  await loadGroup(request, params);
  return json({ nameMax: GROUP_NAME_MAX });
};

const quietButton =
  "rounded-md border border-stone-200 dark:border-stone-700 px-3 py-1.5 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors disabled:opacity-50";
const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

export default function GroupPeople() {
  const layout = useRouteLoaderData<GroupLayoutData>("routes/groups.$groupId");
  const { nameMax } = useLoaderData<typeof loader>();
  const renamed = useActionData<{ ok?: boolean; error?: string }>();
  if (!layout) return null;
  const { group, path, inviteUrl } = layout;
  const alone = group.members.length === 1;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-14">
      <section aria-labelledby="people">
        <h2 id="people" className="sr-only">People</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {group.members.map((member) => {
            const inner = (
              <>
                <Avatar firstname={member.firstname} surname={member.surname} icon={member.profileEmoji} />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-stone-900 dark:text-stone-100">
                    {member.firstname} {member.surname}
                    {member.isMe ? <span className="font-normal text-stone-500 dark:text-stone-400"> (you)</span> : null}
                  </span>
                  <span className="block text-sm text-stone-500 dark:text-stone-400">{plural(member.bookCount, "book")}</span>
                </span>
              </>
            );
            const box = "flex items-center gap-3 rounded-xl border border-stone-200 dark:border-stone-800 p-3";
            return (
              <li key={member.id}>
                {member.isFriend ? (
                  <Link to={`/friend/${member.id}`} className={`${box} hover:border-stone-400 dark:hover:border-stone-600 transition-colors`}>
                    {inner}
                  </Link>
                ) : (
                  <span className={box}>{inner}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="space-y-8">
        <GroupInvite name={group.name} url={inviteUrl} alone={alone} path={path} />
        <section aria-labelledby="settings" className="space-y-4">
          <h2 id="settings" className="font-medium text-stone-900 dark:text-stone-100">The group</h2>
          <Form method="post" action={path} className="flex gap-2">
            <input type="hidden" name="intent" value="rename" />
            <input
              name="name"
              defaultValue={group.name}
              key={group.name}
              maxLength={nameMax}
              required
              aria-label="Group name"
              className="min-w-0 flex-1 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-1.5 text-sm text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10"
            />
            <button type="submit" className={quietButton}>
              Rename
            </button>
          </Form>
          {renamed?.error ? <p className="text-sm text-rose-700 dark:text-rose-400">{renamed.error}</p> : null}
          <Form method="post" action={path}>
            <LeaveButton />
          </Form>
        </section>
      </div>
    </div>
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
  const primary =
    "flex-shrink-0 rounded-md bg-forest-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-forest-700 transition-colors";
  return (
    <div className="max-w-xl rounded-xl border border-stone-200 dark:border-stone-800 p-4">
      <h2 className="font-medium text-stone-900 dark:text-stone-100">
        {alone ? "Invite people" : "Invite more people"}
      </h2>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        Anyone with the link can join, and becomes friends with everyone here.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          type="text"
          readOnly
          value={url.replace(/^https?:\/\//, "")}
          aria-label="Invite link"
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 px-3 py-1.5 text-sm text-stone-600 dark:text-stone-300"
        />
        <CopyButton value={url} label="Copy link" className={`flex-shrink-0 ${quietButton}`} />
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
    </div>
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
