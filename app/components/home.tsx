import type { SerializeFrom } from "@remix-run/node";
import { Link } from "@remix-run/react";

import type { FriendActivity } from "~/models/activity.server";
import type { getHomeBooks } from "~/models/book.server";
import { coverSrc } from "~/utils";

import FriendActivityItem from "./friend-activity";

// The signed-in home page, ordered by how soon things need you: what's due
// at the top, then your loans both ways side by side, your newest books,
// and what friends have been up to alongside (below, on phones)

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

const DAY = 24 * 60 * 60 * 1000;
// How far ahead "Coming up" looks
const COMING_UP_DAYS = 7;

const monthDay = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// Whole days from today to the due date; negative once it's passed
function daysUntil(date: string) {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const due = new Date(date).setHours(0, 0, 0, 0);
  return Math.round((due - startOfToday) / DAY);
}

function inDays(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

const linkClass =
  "text-sm text-stone-500 dark:text-stone-400 underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-900 dark:hover:text-stone-100 hover:underline";
const headingClass = "text-lg font-semibold text-stone-900 dark:text-stone-100";
const subheadingClass =
  "mb-1 flex items-baseline gap-1.5 text-sm font-semibold text-stone-500 dark:text-stone-400";

function Cover({ book, className }: { book: HomeBook; className: string }) {
  return (
    <span
      className={`block flex-shrink-0 overflow-hidden rounded-xs bg-stone-100 dark:bg-stone-800 ring-1 ring-stone-900/5 dark:ring-white/10 ${className}`}
    >
      <img
        src={coverSrc(book.cover)}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover"
      />
    </span>
  );
}

// One line in "Coming up": overdue or due within the week, either way
interface DueItem {
  book: HomeBook & { dueDate: string };
  person: Person;
  direction: "borrowed" | "lent";
}

function ComingUp({ items }: { items: DueItem[] }) {
  if (items.length === 0) return null;
  return (
    <section
      aria-labelledby="coming-up"
      className="mb-6 flex flex-wrap items-center gap-x-6 border-b border-stone-200 dark:border-stone-800 pb-4"
    >
      {/* One line: a small label, then the items (wrapping on phones) */}
      <h2 id="coming-up" className="whitespace-nowrap text-sm font-semibold text-stone-500 dark:text-stone-400">
        Coming up
      </h2>
      <ul className="flex flex-wrap gap-x-8">
        {items.map(({ book, person, direction }) => {
          const days = daysUntil(book.dueDate);
          const overdue = days < 0;
          const who = `${person.firstname} ${person.surname}`;
          const when = overdue
            ? `${-days} ${days === -1 ? "day" : "days"} overdue`
            : `due ${inDays(days)}`;
          return (
            <li key={book.id}>
              <Link
                to={`/books/${book.id}`}
                className="-mx-2 flex items-center gap-2 rounded-md px-2 py-1 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                    overdue
                      ? "bg-stone-900 dark:bg-stone-100"
                      : "bg-stone-300 dark:bg-stone-600"
                  }`}
                />
                <span className="min-w-0 text-sm text-stone-600 dark:text-stone-300">
                  <span className="font-semibold text-stone-900 dark:text-stone-100">
                    {book.title}
                  </span>{" "}
                  {direction === "borrowed" ? "goes back to" : "is with"} {who}
                  {" · "}
                  <span
                    className={
                      overdue ? "font-semibold text-stone-900 dark:text-stone-100" : ""
                    }
                  >
                    {when}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// A compact list for one direction of lending
function LoanList({
  id,
  title,
  books,
  personLabel,
  empty,
}: {
  id: string;
  title: string;
  books: { book: HomeBook; person: Person | null }[];
  // "From" or "To", so the name doesn't read as the author's
  personLabel: string;
  empty: string;
}) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <h3 id={id} className={subheadingClass}>
        {title}
        <span className="font-normal text-stone-400 dark:text-stone-500">
          {books.length}
        </span>
      </h3>
      {books.length === 0 ? (
        <p className="py-2 text-sm text-stone-400 dark:text-stone-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-stone-100 dark:divide-stone-900">
          {books.map(({ book, person }) => {
            const overdue = book.dueDate ? daysUntil(book.dueDate) < 0 : false;
            return (
              <li key={book.id}>
                <Link
                  to={`/books/${book.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
                >
                  <Cover book={book} className="w-14 h-21" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-stone-900 dark:text-stone-100">
                      {book.title}
                    </span>
                    <span className="block truncate text-sm text-stone-500 dark:text-stone-400">
                      {person
                        ? `${personLabel} ${person.firstname} ${person.surname}`
                        : null}
                      {person && book.dueDate ? " · " : null}
                      {book.dueDate ? (
                        <span
                          className={
                            overdue
                              ? "font-semibold text-stone-900 dark:text-stone-100"
                              : ""
                          }
                        >
                          {overdue ? "overdue" : `due ${monthDay(book.dueDate)}`}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
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
  const ownCount = books.lent.length + books.shelf.length;

  // Overdue first, then whatever's due soonest, in either direction
  const due = (
    book: HomeBook,
    person: Person | null,
    direction: DueItem["direction"],
  ): DueItem[] =>
    person && book.dueDate && daysUntil(book.dueDate) <= COMING_UP_DAYS
      ? [{ book: { ...book, dueDate: book.dueDate }, person, direction }]
      : [];
  const comingUp = [
    ...books.borrowed.flatMap((book) => due(book, book.owner, "borrowed")),
    ...books.lent.flatMap((book) => due(book, book.borrower, "lent")),
  ].sort((a, b) => daysUntil(a.book.dueDate) - daysUntil(b.book.dueDate));

  return (
    <main className="px-4 md:px-8 pt-4 md:pt-8 pb-8 md:pb-10">
      <h1 className="sr-only">Home</h1>
      <ComingUp items={comingUp} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-0">
        <div className="lg:pr-12">
          <section aria-labelledby="loans">
            <h2 id="loans" className={`${headingClass} mb-3`}>
              Loans
            </h2>
            <div className="grid gap-8 sm:grid-cols-2 sm:gap-10">
              <LoanList
                id="borrowing"
                title="Borrowing"
                books={books.borrowed.map((book) => ({ book, person: book.owner }))}
                personLabel="From"
                empty="Nothing borrowed right now."
              />
              <LoanList
                id="lent-out"
                title="Lent out"
                books={books.lent.map((book) => ({ book, person: book.borrower }))}
                personLabel="To"
                empty="Everything's on your shelf."
              />
            </div>
          </section>

          <section
            aria-labelledby="recently-added"
            className="mt-8 border-t border-stone-200 dark:border-stone-800 pt-6"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 id="recently-added" className={`${headingClass} whitespace-nowrap`}>
                Recently added
              </h2>
              <div className="flex items-center gap-4 whitespace-nowrap">
                <Link to="/books" className={linkClass}>
                  {ownCount > 0 ? (
                    <>
                      <span className="sm:hidden">All {ownCount}</span>
                      <span className="hidden sm:inline">
                        All {ownCount} in your library
                      </span>
                    </>
                  ) : (
                    "Library"
                  )}
                </Link>
                <Link
                  to="/search"
                  className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-700 px-3 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors"
                >
                  <span aria-hidden="true" className="text-base leading-none text-stone-400">
                    +
                  </span>
                  Add books
                </Link>
              </div>
            </div>
            {books.recent.length > 0 ? (
              // Two rows: four across on phones (the newest eight), six on
              // wider screens
              <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                {books.recent.map((book, index) => (
                  <li key={book.id} className={index >= 8 ? "hidden sm:block" : undefined}>
                    <Link
                      to={`/books/${book.id}`}
                      title={book.title}
                      className="block hover:opacity-90 transition-opacity"
                    >
                      <Cover book={book} className="w-full aspect-[2/3]" />
                      <span className="mt-1.5 block truncate text-xs text-stone-600 dark:text-stone-300">
                        {book.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-6 text-center text-stone-500 dark:text-stone-400">
                Nothing here yet.{" "}
                <Link
                  to="/search"
                  className="text-stone-800 dark:text-stone-200 underline underline-offset-2"
                >
                  Add your first books
                </Link>
              </p>
            )}
          </section>
        </div>

        {/* Its own column, set off by a rule (above it on phones) */}
        <aside
          aria-labelledby="friend-activity"
          className="border-t border-stone-200 dark:border-stone-800 pt-8 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-12"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="friend-activity" className={headingClass}>
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
              <Link
                to="/friends"
                className="text-stone-800 dark:text-stone-200 underline underline-offset-2"
              >
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
