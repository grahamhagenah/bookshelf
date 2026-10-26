import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData, useNavigation, useSearchParams, useSubmit } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import invariant from "tiny-invariant";

import Avatar from "~/components/avatar";
import BookCover from "~/components/book-cover";
import FriendActivityItem from "~/components/friend-activity";
import { SearchIcon } from "~/components/icons";
import InviteMessage from "~/components/invite-message";
import Layout from "~/components / Layout/Layout";
import { codeFromLink, groupInvitePath, groupPath } from "~/group-links";
import { isNotLending } from "~/lending";
import { getFriendActivity } from "~/models/activity.server";
import {
  GROUP_MAX_MEMBERS,
  GROUP_PAGE,
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
  const asked = Number(url.searchParams.get("shown"));
  const shown = Math.min(
    GROUP_MOST,
    Math.max(GROUP_PAGE, Number.isFinite(asked) ? Math.floor(asked) : GROUP_PAGE),
  );
  const [activity, highlights, results] = await Promise.all([
    // What the people in it have been up to, as the feed shows it
    getFriendActivity(userId, { among: openIds, limit: 8 }),
    browsing ? null : getGroupHighlights(userId, openIds),
    browsing ? searchGroupBooks(openIds, { q, who, available, shown }) : null,
  ]);
  return json({
    group: rest,
    search: { q, who, available, shown, browsing },
    highlights,
    results,
    activity,
    friendIds: openIds,
    inviteUrl: `${publicOrigin(request)}${groupInvitePath(group.name, inviteToken)}`,
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
// The most a search shows, however many times Show more is pressed
const GROUP_MOST = 1000;

export default function GroupPage() {
  const { group, search, highlights, results, activity, friendIds, inviteUrl, maxMembers, nameMax } =
    useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const justJoined = searchParams.get("joined") === "1";
  const others = group.members.filter((member) => !member.isMe);
  const lenders = others.filter((member) => member.isFriend);
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

interface ShelfBook {
  id: string;
  title: string;
  author: string;
  cover: string;
  borrowerId: string | null;
  notLendingUntil: string | null;
  user: { id: string; firstname: string };
}

// Covers with whose they are and whether they're in
function ShelfGrid({ books }: { books: ShelfBook[] }) {
  return (
    <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
      {books.map((book) => (
        <li key={book.id}>
          <Link to={`/books/${book.id}`} title={book.title} className="block hover:opacity-90 transition-opacity">
            <BookCover cover={book.cover} title={book.title} author={book.author} className="w-full aspect-[2/3]" />
            <span className="mt-1.5 block truncate text-xs text-stone-700 dark:text-stone-300">{book.title}</span>
            <span className="block truncate text-xs text-stone-500 dark:text-stone-400">
              {book.user.firstname}
              {book.borrowerId ? " · Lent out" : isNotLending(book.notLendingUntil) ? " · Not lending" : ""}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

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
  search: { q: string; who: string | null; available: boolean; shown: number; browsing: boolean };
  highlights: { wanted: ShelfBook[]; newest: ShelfBook[] } | null;
  results: { books: ShelfBook[]; total: number } | null;
}) {
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
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
        {lenders.length > 1 ? (
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
                : results.total === bookCount
                  ? `All ${plural(bookCount, "book")}`
                  : plural(results.total, "book")}
            </p>
            <Link to="?" preventScrollReset replace className="text-sm text-stone-500 dark:text-stone-400 underline-offset-4 hover:underline">
              Clear
            </Link>
          </div>
          {results.books.length > 0 ? <ShelfGrid books={results.books} /> : null}
          {results.total > results.books.length ? (
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
              <ShelfGrid books={highlights.wanted} />
            </div>
          ) : null}
          {highlights.newest.length > 0 ? (
            <div>
              <h3 className={`mb-3 ${heading}`}>New in the group</h3>
              <ShelfGrid books={highlights.newest} />
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
