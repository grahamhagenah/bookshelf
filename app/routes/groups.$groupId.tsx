import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction, SerializeFrom } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  Link,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import invariant from "tiny-invariant";

import Avatar from "~/components/avatar";
import BookCover from "~/components/book-cover";
import CopyButton from "~/components/copy-button";
import FriendActivityItem from "~/components/friend-activity";
import { SearchIcon } from "~/components/icons";
import { mailtoInvite } from "~/components/invite-message";
import Layout from "~/components / Layout/Layout";
import { codeFromLink, groupInvitePath, groupPath } from "~/group-links";
import { getFriendActivity } from "~/models/activity.server";
import type { GroupWork } from "~/models/group.server";
import {
  GROUP_PAGE,
  GROUP_SORTS,
  getGroupHighlights,
  searchGroupBooks,
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
  const group = await getGroup(codeFromLink(params.groupId), userId);
  if (!group) throw new Response("Not Found", { status: 404 });
  const { inviteToken, openIds, ...rest } = group;

  // The address carries the group's name as it is now, for a link from
  // before a rename or one with just the id
  const url = new URL(request.url);
  const canonical = groupPath(group);
  if (url.pathname !== canonical) return redirect(`${canonical}${url.search}`);

  // Searching or filtering shows matching books; otherwise the page opens
  // on a couple of short rows
  const q = (url.searchParams.get("q") ?? "").slice(0, 100);
  const whoParam = url.searchParams.get("who");
  const who = whoParam && openIds.includes(whoParam) ? whoParam : null;
  const available = url.searchParams.get("available") === "1";
  const browsing = url.searchParams.get("all") === "1" || Boolean(q.trim() || who || available);
  const sortParam = url.searchParams.get("sort");
  const sort = GROUP_SORTS.find((option) => option === sortParam) ?? "newest";
  const asked = Number(url.searchParams.get("shown"));
  const shown = Math.min(
    GROUP_MOST,
    Math.max(GROUP_PAGE, Number.isFinite(asked) ? Math.floor(asked) : GROUP_PAGE),
  );
  const [activity, highlights, results] = await Promise.all([
    // What the people in it have been up to, as the feed shows it
    getFriendActivity(userId, { among: openIds, limit: 8 }),
    browsing ? null : getGroupHighlights(userId, openIds),
    browsing ? searchGroupBooks(openIds, { q, who, available, sort, shown }) : null,
  ]);
  return json({
    group: rest,
    search: { q, who, available, sort, shown, browsing },
    highlights,
    results,
    activity,
    friendIds: openIds,
    inviteUrl: `${publicOrigin(request)}${groupInvitePath(group.name, inviteToken)}`,
    nameMax: GROUP_NAME_MAX,
  });
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  invariant(params.groupId, "groupId not found");
  const formData = await request.formData();
  const intent = formData.get("intent");
  if (intent === "leave") {
    await leaveGroup(userId, codeFromLink(params.groupId));
    return redirect("/groups");
  }
  if (intent === "rename") {
    const name = cleanGroupName(formData.get("name"));
    if (!name) return json({ error: "Give the group a name." }, { status: 400 });
    await renameGroup(userId, codeFromLink(params.groupId), name);
    return json({ ok: true });
  }
  if (intent === "resetLink") {
    await resetGroupLink(userId, codeFromLink(params.groupId));
    return json({ ok: true });
  }
  return json({ error: "Unknown request" }, { status: 400 });
};

const quietButton =
  "rounded-md border border-stone-200 dark:border-stone-700 px-3 py-1.5 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors disabled:opacity-50";
const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;
const people = (n: number) => `${n} ${n === 1 ? "person" : "people"}`;
// The members listed before Show all
const MEMBERS_SHOWN = 10;
// The most a search shows, however many times Show more is pressed
const GROUP_MOST = 1000;

export default function GroupPage() {
  const { group, search, highlights, results, activity, friendIds, inviteUrl, nameMax } =
    useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const justJoined = searchParams.get("joined") === "1";
  const others = group.members.filter((member) => !member.isMe);
  const lenders = others.filter((member) => member.isFriend);
  const [renaming, setRenaming] = useState(false);
  const [allMembers, setAllMembers] = useState(false);

  return (
    <Layout
      title={group.name}
      aside={
        <aside aria-labelledby="members" className="mt-10 lg:mt-0">
          <h2 id="members" className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            {group.members.length} {group.members.length === 1 ? "person" : "people"}
          </h2>
          <ul className="mt-3 space-y-3">
            {(allMembers ? group.members : group.members.slice(0, MEMBERS_SHOWN)).map((member) => {
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
          {group.members.length > MEMBERS_SHOWN ? (
            <button
              type="button"
              onClick={() => setAllMembers(!allMembers)}
              className="mt-3 text-sm text-stone-500 dark:text-stone-400 underline-offset-4 hover:underline hover:text-stone-800 dark:hover:text-stone-200"
            >
              {allMembers ? "Show fewer" : `Show all ${group.members.length}`}
            </button>
          ) : null}
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
                {lenders.length > 0
                  ? `${plural(group.bookCount, "book")} to borrow from ${people(lenders.length)}. `
                  : "Once people join, their books show up here. "}
                Your {plural(group.myBookCount, "book")} {group.myBookCount === 1 ? "is" : "are"} in it too.
              </p>
            </div>
          )}
          {!renaming ? (
            <button type="button" onClick={() => setRenaming(true)} className={quietButton}>
              Rename
            </button>
          ) : null}
        </div>

        {lenders.length > 0 ? (
          <GroupShelf
            groupName={group.name}
            lenders={lenders}
            bookCount={group.bookCount}
            search={search}
            highlights={highlights}
            results={results}
          />
        ) : null}
      </section>

      {activity.length > 0 ? (
        <section aria-labelledby="lately">
          <h2 id="lately" className="text-lg font-semibold text-stone-900 dark:text-stone-100">
            Lately in {group.name}
          </h2>
          <ul className="mt-2 max-w-2xl divide-y divide-stone-100 dark:divide-stone-800">
            {activity.map((item) => (
              <li key={item.id}>
                <FriendActivityItem item={item} friendIds={friendIds} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <GroupInvite name={group.name} url={inviteUrl} alone={others.length === 0} />
      </section>
    </Layout>
  );
}

type ShelfWork = SerializeFrom<GroupWork>;

// "Maya", "Maya and Sam", "Maya, Sam and 4 others"
function whoHasIt(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  const others = names.length - 2;
  return `${names[0]}, ${names[1]} and ${others} ${others === 1 ? "other" : "others"}`;
}

// One cover per book, with everyone who has a copy and whether one's
// free. It opens the copy you could borrow soonest.
function ShelfGrid({ works }: { works: ShelfWork[] }) {
  return (
    <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
      {works.map((work) => {
        const free = work.copies.filter((copy) => copy.available).length;
        const status =
          work.copies.length > 1
            ? free > 0
              ? `${free} available`
              : "All lent out"
            : work.copies[0].lent
              ? "Lent out"
              : work.copies[0].available
                ? null
                : "Not lending";
        return (
          <li key={work.key}>
            <Link
              to={`/books/${work.copies[0].bookId}`}
              title={work.title}
              className="block hover:opacity-90 transition-opacity"
            >
              <BookCover cover={work.cover} title={work.title} author={work.author} className="w-full aspect-[2/3]" />
              <span className="mt-1.5 block truncate text-xs text-stone-700 dark:text-stone-300">{work.title}</span>
              <span className="block truncate text-xs text-stone-500 dark:text-stone-400">
                {whoHasIt([...new Set(work.copies.map((copy) => copy.owner.firstname))])}
              </span>
              {status ? (
                <span className="block truncate text-xs text-stone-400 dark:text-stone-500">{status}</span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// More people than this, and the person filter is a menu instead of chips
const PEOPLE_AS_CHIPS = 6;

const chip = (on: boolean) =>
  `inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm transition-colors ${
    on
      ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900"
      : "border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500"
  }`;

// Everyone else's books: a search and a couple of filters, and until you
// use them, what's on your want-to-read list and what's new. Your own
// books stay out; you don't come here for them.
function GroupShelf({
  groupName,
  lenders,
  bookCount,
  search,
  highlights,
  results,
}: {
  groupName: string;
  lenders: { id: string; firstname: string; surname: string; profileEmoji: string | null }[];
  bookCount: number;
  search: { q: string; who: string | null; available: boolean; sort: string; shown: number; browsing: boolean };
  highlights: { wanted: ShelfWork[]; newest: ShelfWork[] } | null;
  results: { works: ShelfWork[]; total: number } | null;
}) {
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const searching = useNavigation().state === "loading";
  // The box keeps what's typed; Clear, or going back, puts the address's in
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(search.q);
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setText(search.q);
  }, [search.q]);

  // The page's address with some filters changed; any Show more starts over
  const hrefWith = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    next.delete("shown");
    next.delete("joined");
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    return query ? `?${query}` : "?";
  };
  const heading = "text-sm font-medium text-stone-500 dark:text-stone-400";

  return (
    <div className="mt-6">
      <Form
        ref={formRef}
        method="get"
        role="search"
        className="relative max-w-xl"
        onChange={() => {
          // Search as they type, once typing pauses
          clearTimeout(timer.current);
          timer.current = setTimeout(() => submit(formRef.current, { replace: true, preventScrollReset: true }), 300);
        }}
      >
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">
          <SearchIcon size={16} />
        </span>
        <input
          type="search"
          name="q"
          ref={inputRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={`Search ${groupName}'s shelves`}
          aria-label={`Search ${groupName}'s shelves by title or author`}
          autoComplete="off"
          className="w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 py-2 pl-9 pr-3 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10 transition-colors"
        />
        {search.who ? <input type="hidden" name="who" value={search.who} /> : null}
        {search.available ? <input type="hidden" name="available" value="1" /> : null}
      </Form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          to={hrefWith({ available: search.available ? null : "1" })}
          preventScrollReset
          replace
          aria-pressed={search.available}
          className={chip(search.available)}
        >
          Available now
        </Link>
        {lenders.length > PEOPLE_AS_CHIPS ? (
          // Too many people for a row of chips
          <span className="relative">
            <select
              value={search.who ?? ""}
              onChange={(event) =>
                navigate(hrefWith({ who: event.target.value || null }), { replace: true, preventScrollReset: true })
              }
              aria-label="Whose books"
              className={`${chip(Boolean(search.who))} appearance-none pr-8`}
            >
              <option value="">Anyone</option>
              {lenders.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.firstname} {member.surname}
                </option>
              ))}
            </select>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden="true"
              className={`pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 ${
                search.who ? "text-white dark:text-stone-900" : "text-stone-500 dark:text-stone-400"
              }`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        ) : lenders.length > 1 ? (
          <>
            <span className="mx-1 h-5 w-px bg-stone-200 dark:bg-stone-700" aria-hidden="true" />
            {lenders.map((member) => {
              const on = search.who === member.id;
              return (
                <Link
                  key={member.id}
                  to={hrefWith({ who: on ? null : member.id })}
                  preventScrollReset
                  replace
                  aria-pressed={on}
                  className={`${chip(on)} pl-1`}
                >
                  <Avatar firstname={member.firstname} surname={member.surname} icon={member.profileEmoji} size="xs" />
                  {member.firstname}
                </Link>
              );
            })}
          </>
        ) : null}
      </div>

      {results ? (
        <div className={`mt-6 transition-opacity ${searching ? "opacity-60" : ""}`}>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <p className={heading} aria-live="polite">
              {results.total === 0
                ? "No books match"
                : search.q || search.who || search.available
                  ? plural(results.total, "book")
                  : `All ${plural(results.total, "book")}`}
            </p>
            <span className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400">
                Sort
                <select
                  value={search.sort}
                  onChange={(event) =>
                    navigate(hrefWith({ sort: event.target.value === "newest" ? null : event.target.value }), {
                      replace: true,
                      preventScrollReset: true,
                    })
                  }
                  className="rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 py-1 pl-2 pr-7 text-sm text-stone-800 dark:text-stone-200"
                >
                  <option value="newest">Newest</option>
                  <option value="title">Title</option>
                  <option value="author">Author</option>
                </select>
              </label>
              <Link to="?" preventScrollReset replace className="text-sm text-stone-500 dark:text-stone-400 underline-offset-4 hover:underline">
                Clear
              </Link>
            </span>
          </div>
          {results.works.length > 0 ? <ShelfGrid works={results.works} /> : null}
          {results.total > results.works.length ? (
            <div className="mt-6 text-center">
              <Link
                to={hrefWith({ shown: String(search.shown + 48) })}
                preventScrollReset
                replace
                className={quietButton}
              >
                Show more
              </Link>
            </div>
          ) : null}
        </div>
      ) : highlights ? (
        <div className="mt-6 space-y-8">
          {highlights.wanted.length > 0 ? (
            <div>
              <h3 className={`mb-3 ${heading}`}>From your want-to-read list</h3>
              <ShelfGrid works={highlights.wanted} />
            </div>
          ) : null}
          {highlights.newest.length > 0 ? (
            <div>
              <h3 className={`mb-3 ${heading}`}>New in the group</h3>
              <ShelfGrid works={highlights.newest} />
            </div>
          ) : null}
          {bookCount > highlights.newest.length ? (
            <Link
              to={hrefWith({ all: "1" })}
              preventScrollReset
              className="inline-block text-sm font-medium text-stone-800 dark:text-stone-200 hover:text-stone-950 dark:hover:text-white"
            >
              Browse all {plural(bookCount, "book")} →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// The link that brings people in: copy it, or send it from your phone or
// email. Resetting it is for a link that's gone further than it should,
// so it asks first.
function GroupInvite({ name, url, alone }: { name: string; url: string; alone: boolean }) {
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
