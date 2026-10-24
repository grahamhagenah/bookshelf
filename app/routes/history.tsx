import type { LoaderFunctionArgs, MetaFunction, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { useState } from "react";

import BookCover from "~/components/book-cover";
import { BorrowedIcon, HeartIcon, HistoryIcon, LentIcon } from "~/components/icons";
import PersonLink from "~/components/person-link";
import ShelfTabs from "~/components/shelf-tabs";
import Layout from "~/components / Layout/Layout";
import { getHistory, getShelfCounts } from "~/models/history.server";
import { getUserById } from "~/models/user.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";

// Every book that's passed between you and a friend, so you can find the
// one you read a few weeks ago and say what you thought of it

export const meta: MetaFunction = () => seo({ title: "History", noindex: true });

export const handle = {
  breadcrumb: () => <span>History</span>,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const [user, entries, counts] = await Promise.all([
    getUserById(userId),
    getHistory(userId),
    getShelfCounts(userId),
  ]);
  return json({
    entries,
    counts,
    friendIds: user?.following.map((friend) => friend.id) ?? [],
  });
};

type Entry = SerializeFrom<typeof loader>["entries"][number];
type Show = "all" | "borrowed" | "lent";

const monthDay = (date: string) => {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
};

function Cover({ cover, title, author }: { cover: string; title: string; author: string }) {
  return <BookCover cover={cover} title={title} author={author} className="h-full w-full" />;
}

const noteLink =
  "font-medium text-stone-800 dark:text-stone-200 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:decoration-stone-500";

function HistoryRow({ entry, friendIds }: { entry: Entry; friendIds: string[] }) {
  const borrowed = entry.kind === "borrowed";
  const name = `${entry.person.firstname} ${entry.person.surname}`;
  const dates = entry.returnedAt
    ? `${monthDay(entry.borrowedAt)} – ${monthDay(entry.returnedAt)}`
    : `Since ${monthDay(entry.borrowedAt)} · ${borrowed ? "you have it now" : "has it now"}`;
  const notes = `/books/${entry.book.id}#notes`;
  const body = entry.note?.body?.trim();

  return (
    // The cover stretches to the height of the row beside it
    <li className="flex gap-4 py-4">
      <Link
        to={`/books/${entry.book.id}`}
        tabIndex={-1}
        aria-hidden="true"
        className="block w-16 flex-shrink-0 self-stretch"
      >
        <Cover cover={entry.book.cover} title={entry.book.title} author={entry.book.author} />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to={`/books/${entry.book.id}`}
          className="font-medium text-stone-900 dark:text-stone-100 hover:underline underline-offset-2"
        >
          {entry.book.title}
        </Link>
        <p className="text-sm text-stone-500 dark:text-stone-400">{entry.book.author}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-stone-600 dark:text-stone-300">
          {borrowed ? (
            <BorrowedIcon size={13} className="text-stone-400 dark:text-stone-500" />
          ) : (
            <LentIcon size={13} className="text-stone-400 dark:text-stone-500" />
          )}
          {borrowed ? "From" : "To"}{" "}
          <PersonLink id={entry.person.id} name={name} friendIds={friendIds} />
          {/* Beside the name on wider screens, a line of its own on phones */}
          <span className="w-full text-stone-400 dark:text-stone-500 sm:w-auto">
            <span className="hidden sm:inline">· </span>
            {dates}
          </span>
        </p>

        {/* What was thought of it: your note on a book you borrowed (or a
            way to leave one), the borrower's on a book you lent */}
        <div className="mt-2 text-sm">
          {body ? (
            <p className="flex items-start gap-1.5 text-stone-700 dark:text-stone-300">
              {entry.note?.loved ? (
                <HeartIcon size={13} filled className="mt-1 flex-shrink-0 text-rose-400" />
              ) : null}
              <span className="line-clamp-2 italic">
                {borrowed ? "You: " : `${entry.person.firstname}: `}“{body}”
              </span>
            </p>
          ) : entry.note?.loved ? (
            <p className="flex items-center gap-1.5 text-stone-500 dark:text-stone-400">
              <HeartIcon size={13} filled className="text-rose-400" />
              {borrowed ? (
                <>
                  You loved it ·{" "}
                  <Link to={notes} className={noteLink}>
                    Add a note
                  </Link>
                </>
              ) : (
                `${entry.person.firstname} loved it`
              )}
            </p>
          ) : borrowed ? (
            <Link to={notes} className={noteLink}>
              Leave a note
            </Link>
          ) : (
            <p className="text-stone-400 dark:text-stone-500">
              No note from {entry.person.firstname} yet
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

export default function History() {
  const { entries, counts, friendIds } = useLoaderData<typeof loader>();
  const [show, setShow] = useState<Show>("all");
  const borrowedCount = entries.filter((entry) => entry.kind === "borrowed").length;
  const filters: [Show, string, number][] = [
    ["all", "All", entries.length],
    ["borrowed", "Borrowed", borrowedCount],
    ["lent", "Lent", entries.length - borrowedCount],
  ];
  const visible = show === "all" ? entries : entries.filter((entry) => entry.kind === show);

  return (
    <Layout title="History">
      <section>
        <ShelfTabs counts={{ ...counts, history: entries.length }} />
        <p className="max-w-xl text-sm text-stone-500 dark:text-stone-400">
          Every book that&apos;s passed between you and a friend, newest first. Read
          something a while back? Leave a note for the next reader.
        </p>

        {entries.length === 0 ? (
          <div className="mt-10 flex flex-col items-center py-10 text-center">
            <HistoryIcon size={28} className="text-stone-300 dark:text-stone-600" />
            <p className="mt-3 text-stone-700 dark:text-stone-300">Nothing here yet.</p>
            <p className="mt-1 max-w-xs text-sm text-stone-500 dark:text-stone-400">
              Books you borrow from friends, and lend to them, show up here.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-4 flex gap-1.5" role="group" aria-label="Show">
              {filters.map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={show === value}
                  onClick={() => setShow(value)}
                  className={`whitespace-nowrap rounded-full px-2.5 py-1 text-sm transition-colors ${
                    show === value
                      ? "bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                      : "text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900 hover:text-stone-800 dark:hover:text-stone-200"
                  }`}
                >
                  {label}
                  <span className="ml-1.5 text-stone-400 dark:text-stone-500">{count}</span>
                </button>
              ))}
            </div>
            <ul className="mt-2 divide-y divide-stone-100 dark:divide-stone-800">
              {visible.map((entry) => (
                <HistoryRow key={`${entry.kind}-${entry.id}`} entry={entry} friendIds={friendIds} />
              ))}
            </ul>
          </>
        )}
      </section>
    </Layout>
  );
}
