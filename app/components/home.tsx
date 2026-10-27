import { Fragment, useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";

import type { FriendActivity } from "~/models/activity.server";
import type { getHomeBooks } from "~/models/book.server";

import BookCover from "./book-cover";
import FriendActivityItem from "./friend-activity";
import { InviteButtons } from "./invite-message";
import { sectionHeading } from "./ui";

// The signed-in home page: a row of your newest books, a row from your
// want-to-read list, then your loans both ways side by side, with what
// friends have been up to alongside (below, on phones)

type HomeBooks = Awaited<ReturnType<typeof getHomeBooks>>;
export interface HomeBook {
  id: string;
  title: string;
  author: string;
  cover: string;
  dueDate: string | Date | null;
}
export interface Person {
  firstname: string;
  surname: string;
}

const DAY = 24 * 60 * 60 * 1000;
// How far ahead "Coming up" looks
const COMING_UP_DAYS = 7;

const monthDay = (date: string | Date) =>
  new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

// Whole days from today to the due date; negative once it's passed
function daysUntil(date: string | Date) {
  const startOfToday = new Date().setHours(0, 0, 0, 0);
  const due = new Date(date).setHours(0, 0, 0, 0);
  return Math.round((due - startOfToday) / DAY);
}

function inDays(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

// How a loan's due date reads in the lists: a plain date when it's a way
// off, counting down once it's within the week, and bold once it's late
function dueLabel(dueDate: string | Date) {
  const days = daysUntil(dueDate);
  if (days < 0) {
    return {
      text: `${-days} ${days === -1 ? "day" : "days"} late`,
      className: "font-semibold text-stone-900 dark:text-stone-100",
    };
  }
  if (days <= COMING_UP_DAYS) {
    return {
      text: `due ${inDays(days)}`,
      className: "font-medium text-stone-700 dark:text-stone-200",
    };
  }
  return { text: `due ${monthDay(dueDate)}`, className: "" };
}

const linkClass =
  "text-sm text-stone-500 dark:text-stone-400 underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-900 dark:hover:text-stone-100 hover:underline";

const LOANS_SHOWN = 3;

// A compact list for one direction of lending (the feed's rail shows it too)
export function LoanList({
  id,
  title,
  books,
  total,
  personLabel,
  empty,
}: {
  id: string;
  title: string;
  books: { book: HomeBook; person: Person | null }[];
  // "From" or "To", so the name doesn't read as the author's
  personLabel: string;
  empty: string;
  // How many there are in all, when only the first few are shown
  total?: number;
}) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <h2
        id={id}
        className={`${sectionHeading} mb-2 flex items-baseline gap-2`}
      >
        {title}
        <span className="text-base font-normal text-stone-400 dark:text-stone-500">
          {total ?? books.length}
        </span>
      </h2>
      {books.length === 0 ? (
        <p className="py-2 text-sm text-stone-400 dark:text-stone-500">
          {empty}
        </p>
      ) : (
        <ul className="divide-y divide-stone-100 dark:divide-stone-900">
          {books.map(({ book, person }) => {
            const due = book.dueDate ? dueLabel(book.dueDate) : null;
            return (
              <li key={book.id}>
                <Link
                  to={`/books/${book.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
                >
                  <BookCover
                    cover={book.cover}
                    title={book.title}
                    className="w-14 h-21"
                  />
                  <span className="min-w-0 flex-1">
                    {/* Up to two lines: still shorter than the cover, so rows keep their height */}
                    <span className="line-clamp-2 font-medium leading-snug text-stone-900 dark:text-stone-100">
                      {book.title}
                    </span>
                    <span className="block truncate text-sm text-stone-500 dark:text-stone-400">
                      {person
                        ? `${personLabel} ${person.firstname} ${person.surname}`
                        : null}
                      {person && due ? " · " : null}
                      {due ? (
                        <span className={due.className}>{due.text}</span>
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

const actionClass =
  "inline-flex h-8 items-center rounded-md border border-stone-200 dark:border-stone-700 px-3 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors";

function StepMark({ number, done }: { number: number; done: boolean }) {
  return done ? (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12.5l4.5 4.5L19 7.5" />
      </svg>
      <span className="sr-only">Done:</span>
    </span>
  ) : (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 text-sm font-semibold text-stone-600 dark:bg-stone-800 dark:text-stone-300">
      {number}
    </span>
  );
}

// A first goal: enough books that a friend browsing finds something
export const BOOK_GOAL = 10;

// For a new account: three steps to a working shelf, each ticked off as
// it's done. Shown until you have ten books and a friend (or have asked
// one), or until you skip it.
function Welcome({
  bookCount,
  friendCount,
  requestsSent,
  inviteUrl,
  divided,
}: {
  bookCount: number;
  friendCount: number;
  requestsSent: number;
  inviteUrl: string;
  // A rule underneath only when something follows
  divided: boolean;
}) {
  const welcomeFetcher = useFetcher({ key: "welcome" });

  const steps = [
    {
      title: `Start with ${BOOK_GOAL} books`,
      text: "Scan the barcodes on your nearest shelf, search by title, or import from Goodreads or StoryGraph.",
      done: bookCount >= BOOK_GOAL,
      doneText: `${bookCount} books on your shelf`,
      progress: bookCount > 0 && bookCount < BOOK_GOAL ? bookCount : null,
      action: (
        <span className="flex flex-wrap items-center gap-2">
          <Link to="/search?scan=1" className={`${actionClass} sm:hidden`}>
            Scan barcodes
          </Link>
          <Link to="/search" className={actionClass}>
            Add books
          </Link>
          <Link to="/import" className={actionClass}>
            Import
          </Link>
        </span>
      ),
    },
    {
      title: "Find your friends",
      text: "Paste the email addresses of people you lend to, and see who's already here.",
      // Asking counts: accepting is up to them
      done: friendCount + requestsSent > 0,
      doneText: friendCount
        ? `${friendCount} ${friendCount === 1 ? "friend" : "friends"}`
        : `${requestsSent === 1 ? "Request" : `${requestsSent} requests`} sent`,
      progress: null,
      action: (
        <Link to="/friends/add#by-email" className={actionClass}>
          Find friends
        </Link>
      ),
    },
    {
      title: "Invite the rest",
      text: "Send a ready-made message with your invite link. Whoever joins from it is your friend straight away.",
      done: false,
      doneText: null,
      progress: null,
      action: <InviteButtons url={inviteUrl} />,
    },
  ];

  return (
    <section
      aria-labelledby="welcome"
      className={
        divided
          ? "mb-8 border-b border-stone-200 dark:border-stone-800 pb-8"
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="welcome"
            className="text-xl font-semibold text-stone-900 dark:text-stone-100"
          >
            Welcome to Stacks
          </h2>
          <p className="mt-1 text-stone-500 dark:text-stone-400">
            Three steps to get your shelf going.
          </p>
        </div>
        <welcomeFetcher.Form method="post" action="/?index">
          <button
            type="submit"
            className="whitespace-nowrap py-1 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 underline-offset-4 hover:underline transition-colors"
          >
            Skip for now
          </button>
        </welcomeFetcher.Form>
      </div>
      <ol className="mt-6 grid gap-8 sm:grid-cols-3 sm:gap-10">
        {steps.map((step, index) => (
          <li key={step.title}>
            <StepMark number={index + 1} done={step.done} />
            <h3
              className={`mt-3 font-semibold ${
                step.done
                  ? "text-stone-500 dark:text-stone-400"
                  : "text-stone-900 dark:text-stone-100"
              }`}
            >
              {step.title}
            </h3>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              {step.text}
            </p>
            {step.progress !== null ? (
              <div className="mt-3 flex items-center gap-3">
                <div
                  className="h-1.5 flex-1 rounded-full bg-stone-100 dark:bg-stone-800"
                  role="progressbar"
                  aria-label="Books on your shelf"
                  aria-valuenow={step.progress}
                  aria-valuemin={0}
                  aria-valuemax={BOOK_GOAL}
                >
                  <div
                    className="h-full rounded-full bg-forest-600 dark:bg-forest-400"
                    style={{ width: `${(step.progress / BOOK_GOAL) * 100}%` }}
                  />
                </div>
                <span className="text-sm tabular-nums text-stone-500 dark:text-stone-400">
                  {step.progress} of {BOOK_GOAL}
                </span>
              </div>
            ) : null}
            <div className="mt-3">
              {!step.done ? (
                step.action
              ) : (
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  {step.doneText}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// The way from the home page's few posts to the whole feed
function SeeMore({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/feed"
      className={`inline-flex h-8 items-center rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors ${className}`}
    >
      See more
    </Link>
  );
}

interface Wanted {
  id: string;
  title: string;
  author: string;
  cover: string;
  // "Maya and Sam have it", when friends do
  owners: string | null;
  // A copy, the book on the list to pick a copy, or a search for it
  to: string;
}

// One of the books passed around most among friends
interface Popular {
  id: string;
  title: string;
  author: string;
  cover: string;
  // How many times friends' copies of it have been lent
  loans: number;
  // "Maya and Sam have it"
  owners: string | null;
  // A friend's copy, one free to ask for first
  to: string;
}

// One row of covers: four on phones, six on wider screens
function CoverRow({
  items,
  caption,
}: {
  items: {
    id: string;
    title: string;
    author?: string | null;
    cover: string;
    to: string;
  }[];
  caption: (index: number) => React.ReactNode;
}) {
  return (
    <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
      {items.slice(0, 6).map((item, index) => (
        <li
          key={item.id}
          className={index >= 4 ? "hidden sm:block" : undefined}
        >
          <Link
            to={item.to}
            title={item.title}
            className="block hover:opacity-90 transition-opacity"
          >
            <BookCover
              cover={item.cover}
              title={item.title}
              author={item.author}
              className="w-full aspect-[2/3]"
            />
            <span className="mt-1.5 block truncate text-xs text-stone-600 dark:text-stone-300">
              {item.title}
            </span>
            {caption(index)}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function Home({
  books,
  wanted,
  popular,
  activity,
  friendIds,
  requestsSent,
  inviteUrl,
  welcomeDismissed,
}: {
  books: HomeBooks;
  wanted: Wanted[];
  popular: Popular[];
  activity: FriendActivity[];
  friendIds: string[];
  requestsSent: number;
  inviteUrl: string;
  welcomeDismissed: boolean;
}) {
  const ownCount = books.lent.length + books.shelf.length;
  // Skipping hides the steps at once, before the cookie's even back
  const skipping = useFetcher({ key: "welcome" }).state !== "idle";

  // A new account gets the welcome steps; each section below appears once
  // it has something in it, so there's no stack of empty boxes. Skipping
  // the steps shows the usual home, empty sections and all.
  const setupDone =
    welcomeDismissed ||
    skipping ||
    (ownCount >= BOOK_GOAL && friendIds.length + requestsSent > 0);
  const showLoans = setupDone || books.borrowed.length + books.lent.length > 0;
  const showRecent = setupDone || ownCount > 0;
  const showWanted = setupDone || wanted.length > 0;
  const showFeed = setupDone || friendIds.length > 0;
  // Only with something to show: it's for finding books, not setting up
  const showPopular = popular.length > 0;
  const showMain = showLoans || showRecent || showWanted || showPopular;
  // Every section after the first is set off by a rule
  const divided = "mt-8 border-t border-stone-200 dark:border-stone-800 pt-6";
  // Loans, three each way unless asked for all
  const [allLoans, setAllLoans] = useState(false);
  // Whether the side column's activity runs past the main column, so it's
  // cut there with a fade
  const railRef = useRef<HTMLDivElement>(null);
  const [railCut, setRailCut] = useState(false);
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const check = () => setRailCut(rail.scrollHeight > rail.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(rail);
    // Its contents too, as posts come and go
    for (const child of Array.from(rail.children)) observer.observe(child);
    return () => observer.disconnect();
  }, []);
  const hiddenLoans =
    Math.max(0, books.borrowed.length - LOANS_SHOWN) +
    Math.max(0, books.lent.length - LOANS_SHOWN);

  return (
    <main className="px-4 md:px-8 pt-4 md:pt-8 pb-8 md:pb-10">
      <h1 className="sr-only">Home</h1>
      {setupDone ? null : (
        <Welcome
          bookCount={ownCount}
          friendCount={friendIds.length}
          requestsSent={requestsSent}
          inviteUrl={inviteUrl}
          divided={showMain || showFeed}
        />
      )}

      <div
        className={`grid gap-10 lg:gap-0 ${
          showMain && showFeed ? "lg:grid-cols-[minmax(0,1fr)_23rem]" : ""
        }`}
      >
        {showMain ? (
          <div className={showFeed ? "lg:pr-10" : undefined}>
            {/* By rank: loans first when there are any, then your recent
                books, then want-to-read (lifted above your books when a
                friend has one of them). Empty ones (shown once setup's
                done) drop to the bottom, so a page without loans doesn't
                open on an empty Loans */}
            {[
              {
                key: "loans",
                show: showLoans,
                // Late and due-soon books need doing
                rank: books.borrowed.length + books.lent.length > 0 ? 0 : 10,
                render: (first: boolean) => (
                  // No heading of its own: Borrowing and Lent out say it
                  <section
                    aria-label="Loans"
                    className={first ? undefined : divided}
                  >
                    <div className="grid gap-8 sm:grid-cols-2 sm:gap-10">
                      <LoanList
                        id="borrowing"
                        title="Borrowing"
                        books={books.borrowed
                          .slice(0, allLoans ? undefined : LOANS_SHOWN)
                          .map((book) => ({ book, person: book.owner }))}
                        total={books.borrowed.length}
                        personLabel="From"
                        empty="Nothing borrowed right now."
                      />
                      <LoanList
                        id="lent-out"
                        title="Lent out"
                        books={books.lent
                          .slice(0, allLoans ? undefined : LOANS_SHOWN)
                          .map((book) => ({ book, person: book.borrower }))}
                        total={books.lent.length}
                        personLabel="To"
                        empty="Everything's on your shelf."
                      />
                    </div>
                    {/* The most pressing few each way show (late and due
                        soon come first); the rest on request */}
                    {hiddenLoans > 0 || allLoans ? (
                      <button
                        type="button"
                        onClick={() => setAllLoans((all) => !all)}
                        aria-expanded={allLoans}
                        className={`mt-3 whitespace-nowrap ${linkClass}`}
                      >
                        {allLoans
                          ? "Show fewer loans"
                          : `Show all ${books.borrowed.length + books.lent.length} loans`}
                      </button>
                    ) : null}
                  </section>
                ),
              },
              {
                key: "wanted",
                show: showWanted,
                // Above your own books only when a friend has one to lend
                rank: wanted.some((item) => item.owners)
                  ? 1
                  : wanted.length > 0
                    ? 3
                    : 11,
                render: (first: boolean) => (
                  <section
                    aria-labelledby="want-to-read"
                    className={first ? undefined : divided}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2
                        id="want-to-read"
                        className={`${sectionHeading} whitespace-nowrap`}
                      >
                        Want to read
                      </h2>
                      <div className="flex items-center gap-4 whitespace-nowrap">
                        {wanted.length > 0 ? (
                          <Link to="/want-to-read" className={linkClass}>
                            All {wanted.length}
                          </Link>
                        ) : null}
                        <Link to="/search?for=want" className={linkClass}>
                          Find a book
                        </Link>
                      </div>
                    </div>
                    {wanted.length > 0 ? (
                      <CoverRow
                        items={wanted}
                        caption={(index) => (
                          // Two lines, so "Maya and Sam have it" isn't cut short
                          <span className="line-clamp-2 text-xs text-stone-400 dark:text-stone-500">
                            {wanted[index].owners ?? "\u00a0"}
                          </span>
                        )}
                      />
                    ) : (
                      <p className="py-6 text-center text-stone-500 dark:text-stone-400">
                        Books you&apos;d like to read go here, and you&apos;ll
                        hear when a friend has one.{" "}
                        <Link
                          to="/search?for=want"
                          className="text-stone-800 dark:text-stone-200 underline underline-offset-2"
                        >
                          Find one
                        </Link>
                      </p>
                    )}
                  </section>
                ),
              },
              {
                key: "popular",
                show: showPopular,
                // Something new to borrow, above your own books
                rank: 1.5,
                render: (first: boolean) => (
                  <section
                    aria-labelledby="popular"
                    className={first ? undefined : divided}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2
                        id="popular"
                        className={`${sectionHeading} whitespace-nowrap`}
                      >
                        Popular with friends
                      </h2>
                      <Link
                        to="/friends/books"
                        className={`whitespace-nowrap ${linkClass}`}
                      >
                        Friends&apos; books
                      </Link>
                    </div>
                    <CoverRow
                      items={popular}
                      caption={(index) => (
                        <span className="line-clamp-2 text-xs text-stone-400 dark:text-stone-500">
                          {popular[index].loans === 1
                            ? "Lent once"
                            : `Lent ${popular[index].loans} times`}
                          {popular[index].owners ? (
                            <>
                              <br />
                              {popular[index].owners}
                            </>
                          ) : null}
                        </span>
                      )}
                    />
                  </section>
                ),
              },
              {
                key: "recent",
                show: showRecent,
                rank: books.recent.length > 0 ? 2 : 12,
                render: (first: boolean) => (
                  <section
                    aria-labelledby="recently-added"
                    className={first ? undefined : divided}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h2
                        id="recently-added"
                        className={`${sectionHeading} whitespace-nowrap`}
                      >
                        Recently added
                      </h2>
                      <div className="flex items-center gap-4 whitespace-nowrap">
                        <Link to="/books" className={linkClass}>
                          {ownCount > 0 ? (
                            <>
                              <span className="sm:hidden">All {ownCount}</span>
                              <span className="hidden sm:inline">
                                All {ownCount} on your shelf
                              </span>
                            </>
                          ) : (
                            "Your shelf"
                          )}
                        </Link>
                        <Link to="/import" className={linkClass}>
                          Import
                        </Link>
                        <Link
                          to="/search"
                          className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-700 px-3 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors"
                        >
                          <span
                            aria-hidden="true"
                            className="text-base leading-none text-stone-400"
                          >
                            +
                          </span>
                          Add books
                        </Link>
                      </div>
                    </div>
                    {books.recent.length > 0 ? (
                      <CoverRow
                        items={books.recent.map((book) => ({
                          ...book,
                          to: `/books/${book.id}`,
                        }))}
                        caption={() => null}
                      />
                    ) : (
                      // A blank, book-shaped slot where the first cover will go
                      <ul className="grid grid-cols-4 gap-3 sm:grid-cols-6">
                        <li>
                          <Link
                            to="/search"
                            className="flex w-full aspect-[2/3] flex-col items-center justify-center gap-1.5 rounded-sm rounded-r-md border-2 border-dashed border-stone-300 dark:border-stone-700 border-l-[6px] border-l-stone-300 dark:border-l-stone-700 [border-left-style:solid] text-stone-500 dark:text-stone-400 hover:border-stone-400 hover:text-stone-800 dark:hover:border-stone-500 dark:hover:text-stone-200 transition-colors"
                          >
                            <span
                              aria-hidden="true"
                              className="text-2xl leading-none"
                            >
                              +
                            </span>
                            <span className="px-1 text-center text-xs font-medium">
                              Add a book
                            </span>
                          </Link>
                        </li>
                        <li className="col-span-3 self-center text-sm text-stone-500 dark:text-stone-400 sm:col-span-5">
                          Nothing here yet. Add your first, or{" "}
                          <Link
                            to="/import"
                            className="text-stone-800 dark:text-stone-200 underline underline-offset-2"
                          >
                            import them
                          </Link>
                          .
                        </li>
                      </ul>
                    )}
                  </section>
                ),
              },
            ]
              .filter((section) => section.show)
              .sort((a, b) => a.rank - b.rank)
              .map((section, index) => (
                <Fragment key={section.key}>
                  {section.render(index === 0)}
                </Fragment>
              ))}
          </div>
        ) : null}

        {/* Its own column, set off by a rule (above it on phones) */}
        {showFeed ? (
          <aside
            aria-labelledby="friend-activity"
            className={
              showMain
                ? "border-t border-stone-200 dark:border-stone-800 pt-8 lg:relative lg:min-h-[30rem] lg:border-t-0 lg:border-l lg:pt-0"
                : undefined
            }
          >
            {/* Beside the main column, no taller than it: what doesn't fit
                fades out, with the way to the rest */}
            <div
              ref={railRef}
              className={
                showMain
                  ? "lg:absolute lg:inset-0 lg:overflow-hidden lg:pl-8"
                  : undefined
              }
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 id="friend-activity" className={sectionHeading}>
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
                    to="/friends/add"
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
              {/* After the last post when they all fit; on the fade when not */}
              {activity.length > 0 && !railCut ? (
                <SeeMore className="mt-3" />
              ) : null}
            </div>
            {showMain && railCut ? (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-28 items-end bg-gradient-to-t from-white from-45% to-transparent pl-8 dark:from-stone-950 lg:flex">
                <SeeMore className="pointer-events-auto" />
              </div>
            ) : null}
          </aside>
        ) : null}
      </div>
    </main>
  );
}
