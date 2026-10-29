import { useEffect, useState } from "react";
import { data, Form, Link, useFetcher, useRouteLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";

import Avatar from "~/components/avatar";
import CopyButton from "~/components/copy-button";
import { mailtoInvite } from "~/components/invite-message";
import { quietButton, sectionHeading, textField } from "~/components/ui";
import { GROUP_DESCRIPTION_MAX, GROUP_NAME_MAX, groupInviteText } from "~/group-links";
import { loadGroup } from "~/group-page.server";
import type { LoaderData } from "~/utils";

import type { GroupLayoutData } from "./groups.$groupId";

// What the group is: its description, who's in it (for whoever runs it,
// with the way to take someone out) and its settings: the name, whether its
// page has the planning card, and which of its goings-on reach your alerts.
// Beside them, the link that brings more people in, and the way out.

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  await loadGroup(request, params);
  return data({});
};

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

export default function GroupAbout() {
  const layout = useRouteLoaderData<GroupLayoutData>("routes/groups.$groupId");
  if (!layout) return null;
  const { group, path, inviteUrl } = layout;
  const iRunIt = group.members.some((member) => member.isMe && member.isOwner);
  const founder = group.members.find((member) => member.isOwner);

  return (
    // As the Friends page: what the group is and who's in it across most
    // of the width, and its settings in a narrow side column
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] lg:gap-x-14">
      <div className="min-w-0 space-y-8">
        {/* Fresh for each description, so a save closes the box */}
        <Description key={group.description ?? ""} text={group.description} path={path} />
        <section aria-labelledby="people">
          <h2 id="people" className={`${sectionHeading} mb-3`}>
            People
          </h2>
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
        <section aria-labelledby="settings" className="max-w-xl">
          <h2 id="settings" className={`${sectionHeading} mb-1`}>
            Group settings
          </h2>
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {/* Fresh for each name, so a rename settles the box */}
            <NameSetting key={group.name} name={group.name} path={path} />
            <PlanningSetting on={group.planning} path={path} canChange={iRunIt} founder={founder?.firstname ?? null} />
            <AlertSettings alerts={group.myAlerts} path={path} planning={group.planning} />
          </div>
        </section>
      </div>

      <aside className="space-y-8 self-start">
        <GroupInvite name={group.name} url={inviteUrl} alone={group.members.length === 1} path={path} />
        <LeaveOrDelete name={group.name} path={path} runIt={iRunIt} />
      </aside>
    </div>
  );
}

// A few lines on what the group is, for the people in it and anyone who
// opens its invite. Anyone in it can write them.
function Description({ text, path }: { text: string | null; path: string }) {
  const fetcher = useFetcher();
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <fetcher.Form method="post" action={path} onSubmit={() => setEditing(false)} className="max-w-150 space-y-2">
        <input type="hidden" name="intent" value="describe" />
        <label htmlFor="group-description" className="sr-only">
          About the group
        </label>
        <textarea
          id="group-description"
          name="description"
          rows={3}
          maxLength={GROUP_DESCRIPTION_MAX}
          defaultValue={text ?? ""}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          placeholder="What it reads, how often it meets, who it's for"
          className={`${textField} text-sm leading-relaxed`}
        />
        <div className="flex items-center gap-3">
          <button type="submit" className={quietButton("md")}>
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-sm text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200">
            Cancel
          </button>
        </div>
      </fetcher.Form>
    );
  }
  if (!text) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="block w-full max-w-150 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 px-4 py-3 text-left text-sm text-stone-500 dark:text-stone-400 hover:border-stone-400 hover:text-stone-800 dark:hover:border-stone-500 dark:hover:text-stone-200 transition-colors"
      >
        <span className="font-medium text-stone-700 dark:text-stone-200">Add a description.</span> What the group reads, how
        often it meets, who it&apos;s for. It shows on the invite too.
      </button>
    );
  }
  return (
    <section aria-label="About the group" className="max-w-150">
      <p className="whitespace-pre-line text-pretty leading-relaxed text-stone-700 dark:text-stone-300">{text}</p>
      <button type="button" onClick={() => setEditing(true)} className="mt-1 text-xs text-stone-400 dark:text-stone-500 underline-offset-2 hover:underline hover:text-stone-700 dark:hover:text-stone-300">
        Edit
      </button>
    </section>
  );
}

const settingLabel = "text-sm font-medium text-stone-800 dark:text-stone-200";
const settingNote = "mt-0.5 text-xs text-stone-500 dark:text-stone-400";

// The group's name, for anyone in it to change
function NameSetting({ name, path }: { name: string; path: string }) {
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const [value, setValue] = useState(name);
  const changed = value.trim() !== name && value.trim() !== "";
  return (
    <fetcher.Form method="post" action={path} className="py-4">
      <input type="hidden" name="intent" value="rename" />
      <label htmlFor="group-name" className={settingLabel}>
        Name
      </label>
      <div className="mt-1.5 flex max-w-sm gap-2">
        <input
          id="group-name"
          name="name"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required
          maxLength={GROUP_NAME_MAX}
          className={`${textField} h-9 min-w-0 flex-1 py-0 text-sm`}
        />
        {changed ? (
          <button type="submit" disabled={fetcher.state !== "idle"} className={`${quietButton("md")} flex-shrink-0`}>
            Save
          </button>
        ) : null}
      </div>
      {fetcher.data?.error ? <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">{fetcher.data.error}</p> : null}
    </fetcher.Form>
  );
}

// The planning card (the book, the meetup, the chat) on or off for the
// whole group: for whoever runs it to say, so the others see where it
// stands and who to ask
function PlanningSetting({
  on,
  path,
  canChange,
  founder,
}: {
  on: boolean;
  path: string;
  canChange: boolean;
  founder: string | null;
}) {
  const fetcher = useFetcher();
  const pending = fetcher.formData?.get("on");
  const shown = pending !== undefined && pending !== null ? pending === "1" : on;
  return (
    <div className="py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p id="planning-label" className={settingLabel}>
            Planning card
          </p>
          <p className={settingNote}>
            What you&apos;re reading, your next meetup and your group chat, at the top of the group.
            {canChange ? " Off if you plan in your chat." : ` ${founder ?? "Whoever started the group"} can turn it ${shown ? "off" : "on"}.`}
          </p>
        </div>
        {canChange ? (
          <fetcher.Form method="post" action={path} className="flex-shrink-0">
            <input type="hidden" name="intent" value="planning" />
            <input type="hidden" name="on" value={shown ? "0" : "1"} />
            <button
              type="submit"
              role="switch"
              aria-checked={shown}
              aria-labelledby="planning-label"
              className={`relative mt-0.5 inline-flex h-6 w-10 items-center rounded-full transition-colors ${
                shown ? "bg-forest-600" : "bg-stone-300 dark:bg-stone-700"
              }`}
            >
              <span
                aria-hidden="true"
                className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  shown ? "translate-x-[18px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </fetcher.Form>
        ) : (
          <span className="mt-0.5 flex-shrink-0 text-xs font-medium text-stone-500 dark:text-stone-400">{shown ? "On" : "Off"}</span>
        )}
      </div>
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

// Which of the group's goings-on reach your alerts: yours alone, saved as
// you tick them. Picks and meetups only while the group has its planning
// card
function AlertSettings({
  alerts,
  path,
  planning,
}: {
  alerts: { picks: boolean; meetups: boolean; joins: boolean };
  path: string;
  planning: boolean;
}) {
  const fetcher = useFetcher();
  const choices = [
    ...(planning
      ? [
          { name: "picks", label: "A new book is picked", on: alerts.picks },
          { name: "meetups", label: "A meetup is set or moved", on: alerts.meetups },
        ]
      : []),
    { name: "joins", label: "Someone joins", on: alerts.joins },
  ];
  return (
    <fetcher.Form
      method="post"
      action={path}
      onChange={(event) => fetcher.submit(event.currentTarget)}
      className="py-4"
    >
      <input type="hidden" name="intent" value="alerts" />
      {/* Kept when the planning card is off, so they come back with it */}
      {planning ? null : (
        <>
          {alerts.picks ? <input type="hidden" name="picks" value="on" /> : null}
          {alerts.meetups ? <input type="hidden" name="meetups" value="on" /> : null}
        </>
      )}
      <p className={settingLabel}>Your notifications</p>
      <p className={settingNote}>Alert me when:</p>
      <div className="mt-2 space-y-1.5">
        {choices.map((choice) => (
          <label key={choice.name} className="flex items-center gap-2.5 text-sm text-stone-700 dark:text-stone-300">
            <input
              type="checkbox"
              name={choice.name}
              defaultChecked={choice.on}
              className="h-4 w-4 rounded border-stone-300 text-forest-600 focus:ring-forest-600 dark:border-stone-600"
            />
            {choice.label}
          </label>
        ))}
      </div>
    </fetcher.Form>
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
