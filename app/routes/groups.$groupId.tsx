import { useEffect, useRef, useState } from "react";
import { data, NavLink, Outlet, redirect, useFetcher, useLoaderData, useSearchParams } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import invariant from "tiny-invariant";

import Faces from "~/components/faces";
import { LinkIcon, PencilIcon } from "~/components/icons";
import { GROUP_NAME_MAX, codeFromLink, groupInvitePath, groupPath } from "~/group-links";
import { loadGroup } from "~/group-page.server";
import {
  cleanGroupName,
  deleteGroup,
  leaveGroup,
  removeFromGroup,
  renameGroup,
  resetGroupLink,
} from "~/models/group.server";
import { publicOrigin } from "~/origin.server";
import { pageUrl } from "~/page-url";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";

// A group's page, laid out like My shelf: the group across the top, tabs
// for its books (the Friends page's Books shelf, narrowed to the group),
// what's been happening and who's in it, and the invite where My shelf
// has its share button

export const meta: MetaFunction<typeof loader> = ({ loaderData }) =>
  seo({ title: loaderData?.group.name ?? "Group", noindex: true });

export const handle = {
  // Groups are a tab of Friends, so a group sits under both
  breadcrumbs: (data: { group?: { name: string } } | undefined) => [
    { label: "Friends", href: "/friends" },
    { label: "Groups", href: "/groups" },
    { label: data?.group?.name ?? "Group" },
  ],
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { group } = await loadGroup(request, params);
  // The address carries the group's name as it is now, for a link from
  // before a rename or one with just the id
  const url = pageUrl(request);
  const here = `/groups/${params.groupId}`;
  const path = groupPath(group);
  if (here !== path) return redirect(`${path}${url.pathname.slice(here.length)}${url.search}`);
  const { inviteToken, openIds, ...rest } = group;
  return data({
    group: { ...rest, lenderCount: openIds.length },
    path,
    inviteUrl: `${publicOrigin(request)}${groupInvitePath(group.name, inviteToken)}`,
  });
};

export type GroupLayoutData = typeof loader;

// Renaming, leaving and a fresh invite link, from the People tab
export const action = async ({ params, request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  invariant(params.groupId, "groupId not found");
  const groupId = codeFromLink(params.groupId);
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent === "leave") {
    await leaveGroup(userId, groupId);
    return redirect("/groups");
  }
  if (intent === "rename") {
    const name = cleanGroupName(formData.get("name"));
    if (!name) return data({ error: "Give the group a name." }, { status: 400 });
    await renameGroup(userId, groupId, name);
    return data({ ok: true });
  }
  if (intent === "delete") {
    await deleteGroup(userId, groupId);
    return redirect("/groups");
  }
  if (intent === "remove") {
    const memberId = formData.get("memberId");
    if (typeof memberId === "string") await removeFromGroup(userId, groupId, memberId);
    return data({ ok: true });
  }
  if (intent === "resetLink") {
    await resetGroupLink(userId, groupId);
    return data({ ok: true });
  }
  return data({ error: "Unknown request" }, { status: 400 });
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default function GroupLayout() {
  const { group, path, inviteUrl } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const justJoined = searchParams.get("joined") === "1";

  // As My shelf's tabs: the same weight either way, so switching never
  // nudges the others
  const tab = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 whitespace-nowrap border-b-2 px-1 pb-2.5 font-medium transition-colors ${
      isActive
        ? "border-stone-900 dark:border-stone-100 text-stone-900 dark:text-stone-100"
        : "border-transparent text-stone-500 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600 hover:text-stone-800 dark:hover:text-stone-200"
    }`;
  const count = "font-normal text-stone-400 dark:text-stone-500";

  return (
    <main className="mt-8 md:mt-10 px-4 md:px-8 pb-8">
      {justJoined ? (
        <p
          role="status"
          className="mb-6 rounded-lg bg-stone-100 dark:bg-stone-900 px-4 py-3 text-sm text-stone-700 dark:text-stone-200"
        >
          You&apos;re in. You and everyone in {group.name} are friends now, so you can borrow
          from each other&apos;s shelves.
        </p>
      ) : null}

      <div className="mb-6 flex items-center gap-4">
        {/* Phones give the name the whole width */}
        <div className="hidden flex-shrink-0 sm:block">
          <Faces people={group.members} size="md" max={4} />
        </div>
        <div className="min-w-0">
          {/* Fresh for each name: a rename moves the page to the new name's
              address, and the box closes with it */}
          <GroupName key={group.name} name={group.name} path={path} />
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {group.lenderCount > 0
              ? `${plural(group.members.length, "person", "people")} · ${plural(group.bookCount, "book")} to borrow.${
                  // Only when there's something of yours to mention
                  group.myBookCount > 0
                    ? ` Your ${plural(group.myBookCount, "book")} ${group.myBookCount === 1 ? "is" : "are"} in it too.`
                    : ""
                }`
              : "Just you so far. Invite people and their books show up here."}
          </p>
        </div>
      </div>

      <div className="mb-6 flex items-start gap-3 border-b border-stone-200 dark:border-stone-800">
        <nav
          aria-label={group.name}
          className="-mb-px flex min-w-0 flex-1 gap-5 sm:gap-6 overflow-x-auto [scrollbar-width:none]"
        >
          <NavLink to={path} end className={tab}>
            Books
            <span className={count}>{group.bookCount}</span>
          </NavLink>
          <NavLink to={`${path}/lately`} className={tab}>
            Updates
          </NavLink>
          <NavLink to={`${path}/people`} className={tab}>
            People
            <span className={count}>{group.members.length}</span>
          </NavLink>
        </nav>
        <div className="-mt-1.5">
          <InviteButton name={group.name} url={inviteUrl} />
        </div>
      </div>

      <Outlet />
    </main>
  );
}

// The group's name, with a pencil beside it that turns it into a box to
// rename it in place. Enter saves, Escape puts it back.
function GroupName({ name, path }: { name: string; path: string }) {
  const fetcher = useFetcher<{ ok?: boolean; error?: string }>();
  const [editing, setEditing] = useState(false);
  const saving = fetcher.state !== "idle";
  // Back to the name once it's saved
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) setEditing(false);
  }, [fetcher.state, fetcher.data]);

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <h1 className="text-balance break-words text-xl font-semibold text-stone-900 dark:text-stone-100 sm:text-2xl">
          {name}
        </h1>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label="Rename the group"
          title="Rename"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200 transition-colors"
        >
          <PencilIcon size={16} />
        </button>
      </div>
    );
  }
  return (
    // The same height as the name and its pencil, so nothing below moves
    <fetcher.Form method="post" action={path} className="relative flex items-center gap-2">
      <input type="hidden" name="intent" value="rename" />
      <input
        name="name"
        defaultValue={name}
        required
        maxLength={GROUP_NAME_MAX}
        aria-label="Group name"
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        onFocus={(event) => event.currentTarget.select()}
        onKeyDown={(event) => {
          if (event.key === "Escape") setEditing(false);
        }}
        className="h-8 min-w-0 flex-1 rounded-md border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-900 px-1.5 py-0 text-xl font-semibold leading-none text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10 sm:text-2xl"
      />
      <button
        type="submit"
        disabled={saving}
        className="inline-flex h-8 flex-shrink-0 items-center rounded-md bg-forest-600 px-3 text-sm font-medium text-white hover:bg-forest-700 transition-colors disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="inline-flex h-8 flex-shrink-0 items-center px-1 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200"
      >
        Cancel
      </button>
      {fetcher.data?.error ? (
        <p className="absolute left-0 top-full mt-1 text-sm text-rose-700 dark:text-rose-400">{fetcher.data.error}</p>
      ) : null}
    </fetcher.Form>
  );
}

// Copies the invite link and says so, or on a phone opens the share sheet
// with a line to send with it. The People tab shows the link itself.
function InviteButton({ name, url }: { name: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const onClick = async () => {
    if (typeof navigator.share === "function" && matchMedia("(pointer: coarse)").matches) {
      await navigator
        .share({ title: `Join ${name} on Stacks`, text: `Join ${name} on Stacks, so we can borrow each other's books:`, url })
        .catch(() => undefined);
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 3000);
    } catch {
      // Clipboard can be blocked; the People tab shows the link to select
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      title="Copy the link that lets people join"
      className="inline-flex h-8 flex-shrink-0 items-center justify-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-700 px-2.5 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors"
    >
      <LinkIcon size={16} />
      {/* Both labels share one cell, so the button keeps its width. With
          a mouse it says what it does: copies the link */}
      <span className="grid" aria-live="polite">
        <span className={`col-start-1 row-start-1 ${copied ? "invisible" : ""}`}>
          <span className="pointer-coarse:hidden">Copy invite link</span>
          <span className="hidden pointer-coarse:inline">Invite</span>
        </span>
        <span className={`col-start-1 row-start-1 ${copied ? "" : "invisible"}`}>Link copied</span>
      </span>
    </button>
  );
}
