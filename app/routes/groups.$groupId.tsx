import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { NavLink, Outlet, useLoaderData, useSearchParams } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import invariant from "tiny-invariant";

import Faces from "~/components/faces";
import { BookIcon, FeedIcon, GroupsIcon, LinkIcon } from "~/components/icons";
import { codeFromLink, groupInvitePath, groupPath } from "~/group-links";
import { loadGroup } from "~/group-page.server";
import { cleanGroupName, leaveGroup, renameGroup, resetGroupLink } from "~/models/group.server";
import { publicOrigin } from "~/origin.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";

// A group's page, laid out like My shelf: the group across the top, tabs
// for its shelf, what's been happening and who's in it, and the invite
// where My shelf has its share button

export const meta: MetaFunction<typeof loader> = ({ data }) =>
  seo({ title: data?.group.name ?? "Group", noindex: true });

export const handle = {
  breadcrumbs: (data: { group?: { name: string } } | undefined) => [
    { label: "Groups", href: "/groups" },
    { label: data?.group?.name ?? "Group" },
  ],
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { group } = await loadGroup(request, params);
  // The address carries the group's name as it is now, for a link from
  // before a rename or one with just the id
  const url = new URL(request.url);
  const here = `/groups/${params.groupId}`;
  const path = groupPath(group);
  if (here !== path) return redirect(`${path}${url.pathname.slice(here.length)}${url.search}`);
  const { inviteToken, openIds, ...rest } = group;
  return json({
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
    if (!name) return json({ error: "Give the group a name." }, { status: 400 });
    await renameGroup(userId, groupId, name);
    return json({ ok: true });
  }
  if (intent === "resetLink") {
    await resetGroupLink(userId, groupId);
    return json({ ok: true });
  }
  return json({ error: "Unknown request" }, { status: 400 });
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
          <h1 className="text-balance break-words text-xl font-semibold text-stone-900 dark:text-stone-100 sm:text-2xl">
            {group.name}
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            {group.lenderCount > 0
              ? `${plural(group.members.length, "person", "people")} · ${plural(group.bookCount, "book")} to borrow. Your ${plural(group.myBookCount, "book")} ${group.myBookCount === 1 ? "is" : "are"} in it too.`
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
            <BookIcon size={16} className="hidden sm:block" />
            Shelf
            <span className={count}>{group.bookCount}</span>
          </NavLink>
          <NavLink to={`${path}/lately`} className={tab}>
            <FeedIcon size={16} strokeWidth={1.5} className="hidden sm:block" />
            Lately
          </NavLink>
          <NavLink to={`${path}/people`} className={tab}>
            <GroupsIcon size={17} className="hidden sm:block" />
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

// As Share my shelf: copies the invite link, or on a phone opens the
// share sheet with a line to send with it. The People tab has the rest.
function InviteButton({ name, url }: { name: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
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
      timer.current = setTimeout(() => setCopied(false), 2000);
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
      {/* Both labels share one cell, so the button keeps its width */}
      <span className="grid" aria-live="polite">
        <span className={`col-start-1 row-start-1 ${copied ? "invisible" : ""}`}>Invite</span>
        <span className={`col-start-1 row-start-1 ${copied ? "" : "invisible"}`}>Copied</span>
      </span>
    </button>
  );
}
