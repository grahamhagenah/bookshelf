import type { SerializeFrom } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { useState } from "react";

import type { FriendActivity } from "~/models/activity.server";
import type { getHomeBooks } from "~/models/book.server";
import { coverSrc } from "~/utils";

import FriendActivityItem from "./friend-activity";

// The signed-in home page: your books and where each one is on the left,
// what friends have been up to on the right (below, on phones)

type HomeBooks = SerializeFrom<Awaited<ReturnType<typeof getHomeBooks>>>;
interface HomeBook {
  id: string;
  title: string;
  author: string;
  cover: string;
  dueDate: string | null;
}
interface Person {
  firstname: string;
  surname: string;
}

const monthDay = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const linkClass =
  "text-sm text-stone-500 dark:text-stone-400 underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-900 dark:hover:text-stone-100 hover:underline";

function Due({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;
  return new Date(dueDate) < new Date() ? (
    <span className="font-semibold text-stone-900 dark:text-stone-100">
      Overdue since {monthDay(dueDate)}
    </span>
  ) : (
    <>Due {monthDay(dueDate)}</>
  );
}

function BookRow({
  book,
  person,
  personLabel,
}: {
  book: HomeBook;
  person?: Person | null;
  personLabel?: string;
}) {
  return (
    <Link
      to={`/books/${book.id}`}
      className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
    >
      <span className="block w-8 h-12 flex-shrink-0 overflow-hidden rounded-xs bg-stone-100 dark:bg-stone-800 ring-1 ring-stone-900/5 dark:ring-white/10">
        <img
          src={coverSrc(book.cover)}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-stone-900 dark:text-stone-100">
          {book.title}
        </span>
        <span className="block truncate text-sm text-stone-500 dark:text-stone-400">
          {book.author}
        </span>
      </span>
      {person ? (
        <span className="flex-shrink-0 text-right text-sm text-stone-500 dark:text-stone-400 max-w-[45%]">
          <span className="block truncate">
            {personLabel}{" "}
            <span className="text-stone-700 dark:text-stone-200">
              {person.firstname} {person.surname}
            </span>
          </span>
          <span className="block">
            <Due dueDate={book.dueDate} />
          </span>
        </span>
      ) : null}
    </Link>
  );
}

// The shelf can be long; show a few and let the rest open on request
const SHELF_PREVIEW = 5;

function Group({
  title,
  count,
  children,
  footer,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    // A rule between groups, so each reads as its own block
    <div className="border-t border-stone-200 dark:border-stone-800 pt-5 mt-6 first:border-t-0 first:pt-0 first:mt-0">
      <h3 className="mb-1 flex items-baseline gap-1.5 text-sm font-semibold text-stone-500 dark:text-stone-400">
        {title}
        <span className="font-normal text-stone-400 dark:text-stone-500">{count}</span>
      </h3>
      <ul className="divide-y divide-stone-100 dark:divide-stone-900">{children}</ul>
      {footer}
    </div>
  );
}

export default function Home({
  books,
  activity,
  friendIds,
}: {
  books: HomeBooks;
  activity: SerializeFrom<FriendActivity>[];
  friendIds: string[];
}) {
  const total = books.borrowed.length + books.lent.length + books.shelf.length;
  const [showWholeShelf, setShowWholeShelf] = useState(false);
  const shelf = showWholeShelf ? books.shelf : books.shelf.slice(0, SHELF_PREVIEW);

  return (
    <main className="px-4 md:px-8 py-8 md:py-10">
      <h1 className="sr-only">Home</h1>
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-0">
        <section aria-labelledby="your-books" className="lg:pr-12">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="your-books" className="text-lg font-semibold">
              Your books
            </h2>
            <div className="flex items-center gap-4">
              <Link to="/books" className={linkClass}>
                Library
              </Link>
              <Link
                to="/search"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-700 px-3 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors"
              >
                <span aria-hidden="true" className="text-base leading-none text-stone-400">
                  +
                </span>
                Add books
              </Link>
            </div>
          </div>

          {total === 0 ? (
            <p className="py-10 text-center text-stone-500 dark:text-stone-400">
              Nothing here yet.{" "}
              <Link to="/search" className="text-stone-800 dark:text-stone-200 underline underline-offset-2">
                Add your first books
              </Link>
            </p>
          ) : (
            <>
              <Group title="Borrowed" count={books.borrowed.length}>
                {books.borrowed.map((book) => (
                  <li key={book.id}>
                    <BookRow book={book} person={book.owner} personLabel="From" />
                  </li>
                ))}
              </Group>
              <Group title="Lent out" count={books.lent.length}>
                {books.lent.map((book) => (
                  <li key={book.id}>
                    <BookRow book={book} person={book.borrower} personLabel="With" />
                  </li>
                ))}
              </Group>
              <Group
                title="On your shelf"
                count={books.shelf.length}
                footer={
                  books.shelf.length > SHELF_PREVIEW ? (
                    <button
                      type="button"
                      onClick={() => setShowWholeShelf((open) => !open)}
                      className={`mt-2 ${linkClass}`}
                    >
                      {showWholeShelf
                        ? "Show fewer"
                        : `Show all ${books.shelf.length}`}
                    </button>
                  ) : null
                }
              >
                {shelf.map((book) => (
                  <li key={book.id}>
                    <BookRow book={book} />
                  </li>
                ))}
              </Group>
            </>
          )}
        </section>

        {/* Its own column, set off by a rule (above it on phones) */}
        <aside
          aria-labelledby="friend-activity"
          className="border-t border-stone-200 dark:border-stone-800 pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="friend-activity" className="text-lg font-semibold">
              Friend activity
            </h2>
            {activity.length > 0 ? (
              <Link to="/feed" className={linkClass}>
                See all
              </Link>
            ) : null}
          </div>
          {activity.length > 0 ? (
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {activity.map((item) => (
                <li key={item.id}>
                  <FriendActivityItem item={item} friendIds={friendIds} />
                </li>
              ))}
            </ul>
          ) : friendIds.length === 0 ? (
            <p className="py-2 text-sm text-stone-500 dark:text-stone-400">
              Add friends to see the books they add and love.{" "}
              <Link to="/friends" className="text-stone-800 dark:text-stone-200 underline underline-offset-2">
                Find friends
              </Link>
            </p>
          ) : (
            <p className="py-2 text-sm text-stone-500 dark:text-stone-400">
              Nothing new from your friends lately.
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}
