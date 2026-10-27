import { useState } from "react";
import { data, Link, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

import BookCover from "~/components/book-cover";
import EmptyList from "~/components/empty-list";
import { BorrowedIcon, HeartIcon, HistoryIcon, LentIcon } from "~/components/icons";
import Layout from "~/components/layout";
import PersonLink from "~/components/person-link";
import ShelfTabs from "~/components/shelf-tabs";
import { getHistory, getShelfCounts } from "~/models/history.server";
import { getUserById } from "~/models/user.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";
import type { LoaderData } from "~/utils";

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
  return data({
    entries,
    counts,
    friendIds: user?.following.map((friend) => friend.id) ?? [],
  });
};

type Entry = LoaderData<typeof loader>["entries"][number];
type Show = "all" | "borrowed" | "lent";

const monthDay = (date: string | Date) => {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
};


const noteLink =
  "font-medium text-stone-800 dark:text-stone-200 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:decoration-stone-500";

function HistoryRow({ entry, friendIds }: { entry: Entry; friendIds: string[] }) {
  const borrowed = entry.kind === "borrowed";
  const name = `${entry.person.firstname} ${entry.person.surname}`;
  const person = (
    <strong className="whitespace-nowrap font-semibold text-stone-800 dark:text-stone-200">
      <PersonLink id={entry.person.id} name={name} friendIds={friendIds} />
    </strong>
  );
  const date = (value: string | Date) => (
    <strong className="whitespace-nowrap font-semibold text-stone-800 dark:text-stone-200">
      {monthDay(value)}
    </strong>
  );
  // Told as a sentence: who had it, and when it went and came back
  const story = borrowed ? (
    entry.returnedAt ? (
      <>
        You borrowed it from {person} on {date(entry.borrowedAt)} and gave it
        back {date(entry.returnedAt)}.
      </>
    ) : (
      <>
        You’ve been borrowing it from {person} since {date(entry.borrowedAt)}.
      </>
    )
  ) : entry.returnedAt ? (
    <>
      {person} borrowed it on {date(entry.borrowedAt)} and gave it back{" "}
      {date(entry.returnedAt)}.
    </>
  ) : (
    <>
      {person} has been borrowing it since {date(entry.borrowedAt)}.
    </>
  );
  const notes = `/books/${entry.book.id}#notes`;
  const body = entry.note?.body?.trim();

  return (
    // A cover the size of To read's and Also read's
    <li className="flex gap-4 py-4">
      <Link
        to={`/books/${entry.book.id}`}
        tabIndex={-1}
        aria-hidden="true"
        className="block flex-shrink-0"
      >
        <BookCover cover={entry.book.cover} title={entry.book.title} author={entry.book.author} className="h-24 w-16" />
      </Link>
      <div className="min-w-0 flex-1">
        <Link
          to={`/books/${entry.book.id}`}
          className="font-medium text-stone-900 dark:text-stone-100 hover:underline underline-offset-2"
        >
          {entry.book.title}
        </Link>
        <p className="text-sm text-stone-500 dark:text-stone-400">{entry.book.author}</p>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-stone-600 dark:text-stone-300">
          {borrowed ? (
            <BorrowedIcon size={13} className="mt-[3px] flex-shrink-0 text-stone-400 dark:text-stone-500" />
          ) : (
            <LentIcon size={13} className="mt-[3px] flex-shrink-0 text-stone-400 dark:text-stone-500" />
          )}
          <span>{story}</span>
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

        {entries.length === 0 ? (
          <EmptyList icon={<HistoryIcon size={28} />} title="Your lending history">
            Every book that passes between you and a friend shows up here: what
            you&apos;ve borrowed, and what you&apos;ve lent.
          </EmptyList>
        ) : (
          <>
            {/* What the list is for, above it; while it's empty, in its place */}
            <p className="max-w-xl text-sm text-stone-500 dark:text-stone-400">
              Every book that&apos;s passed between you and a friend.
            </p>
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
