import { Fragment } from "react";
import { Link, useFetcher } from "react-router";

import { daysUntil, dueText } from "~/due";
import type { FriendActivity } from "~/models/activity.server";
import type { getHomeBooks } from "~/models/book.server";

import BookCover from "./book-cover";
import FriendActivityItem from "./friend-activity";
import { BorrowedIcon, LentIcon, SearchIcon } from "./icons";
import { InviteButtons } from "./invite-message";
import ShareShelfOffer from "./share-shelf-offer";
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
// A group you're in, as the home page lists it
export interface HomeGroup {
  id: string;
  name: string;
  memberCount: number;
  // A few of the people in it, for their pictures
  faces: { id: string; firstname: string; surname: string; profileEmoji: string | null }[];
}
// A book you're in line for: whose copy, and your place in line
export interface Waiting {
  book: HomeBook;
  owner: Person;
  place: number;
}

// How far ahead a due date counts as coming up
const COMING_UP_DAYS = 7;

// How a loan's due date reads in the lists: in words (see dueText), a
// little heavier once it's within the week, and bold once it's late
function dueLabel(dueDate: string | Date) {
  const days = daysUntil(dueDate);
  return {
    text: dueText(dueDate),
    className:
      days < 0
        ? "font-semibold text-stone-900 dark:text-stone-100"
        : days <= COMING_UP_DAYS
          ? "font-medium text-stone-700 dark:text-stone-200"
          : "",
  };
}

// Each section's heading is the way to all of it
const headingLink =
  "underline-offset-4 decoration-stone-300 dark:decoration-stone-600 hover:underline";

// A section's one action, beside its heading: a + to add, a magnifying
// glass to go looking
function AddButton({
  to,
  search = false,
  children,
}: {
  to: string;
  search?: boolean;
  children: string;
}) {
  return (
    <Link
      to={to}
      className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-700 px-3 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors"
    >
      {search ? (
        <SearchIcon size={14} className="text-stone-400" />
      ) : (
        <span
          aria-hidden="true"
          className="text-base leading-none text-stone-400"
        >
          +
        </span>
      )}
      {children}
    </Link>
  );
}

// The most pressing few loans each way (late and due soon come first); the
// headings link to the rest on your shelf
const LOANS_SHOWN = 3;
// And as many of friends' latest posts beside them
export const POSTS_SHOWN = 3;
// And of the books most lent around your friends, under them
export const POPULAR_SHOWN = 5;

// One row of a loan list: the book, who it's from or to, and when it's
// due, with a note when something needs doing (someone's waiting for it).
// A row can say its own line instead, as one you're in line for does.
export interface LoanEntry {
  book: HomeBook;
  person: Person | null;
  note?: string | null;
  line?: string;
}

function LoanRows({ entries, personLabel }: { entries: LoanEntry[]; personLabel: string }) {
  return (
    <ul className="divide-y divide-stone-100 dark:divide-stone-900">
      {entries.map(({ book, person, note, line }) => {
        const due = !line && book.dueDate ? dueLabel(book.dueDate) : null;
        return (
          <li key={book.id}>
            <Link
              to={`/books/${book.id}`}
              className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
            >
              <BookCover cover={book.cover} title={book.title} className="w-10 h-15" />
              <span className="min-w-0 flex-1">
                {/* Up to two lines: still shorter than the cover, so rows keep their height */}
                <span className="line-clamp-2 font-medium leading-snug text-stone-900 dark:text-stone-100">
                  {book.title}
                </span>
                <span className="block truncate text-sm text-stone-500 dark:text-stone-400">
                  {line ?? (
                    <>
                      {person ? `${personLabel} ${person.firstname} ${person.surname}` : null}
                      {person && due ? " · " : null}
                      {due ? <span className={due.className}>{due.text}</span> : null}
                    </>
                  )}
                </span>
                {note ? (
                  <span className="block truncate text-sm font-medium text-forest-700 dark:text-forest-400">
                    {note}
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// A compact list for one direction of lending (the feed's rail shows it too)
export function LoanList({
  id,
  title,
  books,
  total,
  personLabel,
  empty,
  to,
  icon,
  children,
}: {
  id: string;
  title: string;
  // The mark the shelf uses for these: borrowed, or lent out
  icon?: React.ReactNode;
  // Where all of them are, which the heading links to
  to?: string;
  books: LoanEntry[];
  // "From" or "To", so the name doesn't read as the author's
  personLabel: string;
  empty: string;
  // How many there are in all, when only the first few are shown
  total?: number;
  // Anything more under the list
  children?: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <h2
        id={id}
        className={`${sectionHeading} mb-2 flex items-baseline gap-2`}
      >
        {icon ? (
          <span className="self-center text-stone-400 dark:text-stone-500">{icon}</span>
        ) : null}
        {to && books.length > 0 ? (
          <Link to={to} className={headingLink}>
            {title}
          </Link>
        ) : (
          title
        )}
        <span className="text-base font-normal text-stone-400 dark:text-stone-500">
          {total ?? books.length}
        </span>
      </h2>
      {books.length === 0 ? (
        <p className="py-2 text-sm text-stone-400 dark:text-stone-500">
          {empty}
        </p>
      ) : (
        <LoanRows entries={books} personLabel={personLabel} />
      )}
      {children}
    </section>
  );
}

// "1st", "2nd", "3rd", "4th"
const ordinal = (n: number) => {
  const tens = n % 100;
  const suffix =
    tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${suffix}`;
};

const actionClass =
  "inline-flex h-8 items-center rounded-md border border-stone-200 dark:border-stone-700 px-3 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors";

function StepMark({ number, done }: { number: number; done: boolean }) {
  return done ? (
    // Ticked off in green: something done, worth a small cheer
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest-600 text-white dark:bg-forest-400 dark:text-stone-950">
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
// it's done. Shown until you have ten books and someone to lend to (a
// friend, one asked, or a name on your list), or until you skip it.
function Welcome({
  bookCount,
  borrowingCount,
  waitingCount,
  friendBookCount,
  friendCount,
  requestsSent,
  nameCount,
  groups,
  inviteUrl,
  sharesShelf,
  divided,
}: {
  bookCount: number;
  borrowingCount: number;
  // Books in line for, which count as borrowing for a start
  waitingCount: number;
  friendBookCount: number;
  friendCount: number;
  requestsSent: number;
  // People lent to by name: neighbors, a class
  nameCount: number;
  groups: HomeGroup[];
  inviteUrl: string;
  sharesShelf: boolean;
  // A rule underneath only when something follows
  divided: boolean;
}) {
  const welcomeFetcher = useFetcher({ key: "welcome" });
  // The first group others have joined
  const clubbed = groups.find((group) => group.memberCount > 1);

  // Someone who came to borrow (friends with books, none of their own
  // yet) starts there; adding a book of their own brings back the shelf
  const borrower = bookCount === 0 && friendBookCount > 0;
  const firstStep = borrower
    ? {
        title: "See what your friends have",
        text: `There ${friendBookCount === 1 ? "is 1 book" : `are ${friendBookCount} books`} on your friends' shelves. Find one to borrow, and add your own whenever you like.`,
        done: borrowingCount + waitingCount > 0,
        doneText: borrowingCount
          ? `Borrowing ${borrowingCount === 1 ? "a book" : `${borrowingCount} books`}`
          : `In line for ${waitingCount === 1 ? "a book" : `${waitingCount} books`}`,
        progress: null,
        action: (
          <span className="flex flex-wrap items-center gap-2">
            <Link to="/friends/books" className={actionClass}>
              Friends&apos; books
            </Link>
            <Link to="/search" className={actionClass}>
              Add yours
            </Link>
          </span>
        ),
      }
    : null;

  const steps = [
    firstStep ?? {
      title: `Start with ${BOOK_GOAL} books`,
      text: "Scan the barcodes on your nearest shelf, search by title, or import a Goodreads export or a spreadsheet.",
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
      title: "Who you lend to",
      text: "Find friends by their email addresses. Lending to neighbors or a class? Lend to them by name.",
      // Asking counts: accepting is up to them. So does a name to lend to.
      done: friendCount + requestsSent + nameCount > 0,
      doneText: friendCount
        ? `${friendCount} ${friendCount === 1 ? "friend" : "friends"}`
        : requestsSent
          ? `${requestsSent === 1 ? "Request" : `${requestsSent} requests`} sent`
          : `${nameCount} ${nameCount === 1 ? "name" : "names"} to lend to`,
      progress: null,
      action: (
        <span className="flex flex-wrap items-center gap-2">
          <Link to="/friends/add#by-email" className={actionClass}>
            Find friends
          </Link>
          <Link to="/checkout" className={actionClass}>
            Lend by name
          </Link>
        </span>
      ),
    },
    {
      title: "Invite the rest",
      text: "Send a ready-made message with your invite link: whoever joins from it is your friend straight away. For a book club or an office, start a group, and everyone who joins can borrow from everyone.",
      // Someone's come in on a group's link
      done: Boolean(clubbed),
      doneText: clubbed
        ? `${clubbed.name}: ${clubbed.memberCount} people`
        : null,
      progress: null,
      action: (
        <span className="flex flex-wrap items-center gap-2">
          <InviteButtons url={inviteUrl} />
          <Link to="/groups" className={actionClass}>
            Start a group
          </Link>
        </span>
      ),
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
      {/* Each step in a quiet box of its own, ruled like the lines between
          the page's sections; a finished one has a touch of green */}
      <ol className="mt-6 grid gap-3 sm:grid-cols-3 sm:gap-4">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className={`rounded-lg border border-stone-200 dark:border-stone-800 p-4 sm:p-5 ${
              step.done ? "bg-forest-600/[0.06] dark:bg-forest-400/10" : ""
            }`}
          >
            <StepMark number={index + 1} done={step.done} />
            <h3
              className="mt-3 font-semibold text-stone-900 dark:text-stone-100"
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
                <p className="text-sm font-medium text-forest-700 dark:text-forest-400">
                  {step.doneText}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {sharesShelf ? null : <ShareShelfOffer className="mt-4" />}
    </section>
  );
}

// The way from a side-column section's few to all of them: words and an
// arrow, lined up with the list above, with no box around them
function MoreLink({ to, children, className = "" }: { to: string; children: string; className?: string }) {
  return (
    <Link
      to={to}
      className={`group inline-flex items-center gap-1.5 py-1 text-sm font-medium text-stone-700 dark:text-stone-200 hover:text-stone-950 dark:hover:text-white transition-colors ${className}`}
    >
      {children}
      <span
        aria-hidden="true"
        className="text-stone-400 dark:text-stone-500 transition-transform group-hover:translate-x-0.5"
      >
        →
      </span>
    </Link>
  );
}

// Friends' books, the most lent first
const POPULAR_PATH = "/friends/books?sort=popular";

// Popular with friends as a chart, the most lent first: ranked rows built
// like the rest of the home page's lists (a small cover, the title, who
// has it), with how many times on the right
function PopularChart({
  popular,
  className = "",
}: {
  popular: Popular[];
  className?: string;
}) {
  return (
    <section
      aria-labelledby="popular"
      className={`mt-8 border-t border-stone-200 dark:border-stone-800 pt-6 ${className}`}
    >
      <h2 id="popular" className={`${sectionHeading} mb-2`}>
        <Link to={POPULAR_PATH} className={headingLink}>
          Popular with friends
        </Link>
      </h2>
      <ol className="divide-y divide-stone-100 dark:divide-stone-900">
        {popular.map((book, index) => {
          const said =
            book.loans === 1 ? "Lent once" : `Lent ${book.loans} times`;
          return (
            <li key={book.id}>
              <Link
                to={book.to}
                className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
              >
                {/* As wide as the friend icons above, so the covers line
                    up with the activity's */}
                <span
                  aria-hidden="true"
                  className="w-7 flex-shrink-0 text-center text-sm font-semibold tabular-nums text-stone-500 dark:text-stone-400"
                >
                  {index + 1}
                </span>
                <BookCover
                  cover={book.cover}
                  title={book.title}
                  className="w-10 h-15 flex-shrink-0"
                />
                {/* Set like the loan rows, whose covers are the same size */}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-medium leading-snug text-stone-900 dark:text-stone-100">
                    {book.title}
                  </span>
                  <span className="block truncate text-sm text-stone-500 dark:text-stone-400">
                    {book.author}
                    {book.owners ? ` · ${book.owners}` : ""}
                  </span>
                </span>
                <span
                  title={said}
                  className="inline-flex flex-shrink-0 items-center gap-1 text-sm tabular-nums text-stone-500 dark:text-stone-400"
                >
                  <LentIcon size={14} />
                  <span aria-hidden="true">{book.loans}</span>
                  <span className="sr-only">{said}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <MoreLink to={POPULAR_PATH} className="mt-3">
        All friends&apos; books
      </MoreLink>
    </section>
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

// One row of covers: four on phones, five on wider screens
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
    <ul className="grid grid-cols-4 gap-3 sm:grid-cols-5">
      {items.slice(0, 5).map((item, index) => (
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
  friendBookCount,
  requestsSent,
  inviteUrl,
  sharesShelf,
  groups,
  waiting,
  nameCount,
  welcomeDismissed,
}: {
  books: HomeBooks;
  wanted: Wanted[];
  popular: Popular[];
  activity: FriendActivity[];
  friendIds: string[];
  // Books on friends' shelves, for a welcome that starts with borrowing
  friendBookCount: number;
  requestsSent: number;
  inviteUrl: string;
  sharesShelf: boolean;
  groups: HomeGroup[];
  waiting: Waiting[];
  nameCount: number;
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
    (ownCount >= BOOK_GOAL && friendIds.length + requestsSent + nameCount > 0);
  const showLoans =
    setupDone || books.borrowed.length + books.lent.length + waiting.length > 0;
  const showRecent = setupDone || ownCount > 0;
  const showWanted = setupDone || wanted.length > 0;
  const showFeed = setupDone || friendIds.length > 0;
  const showMain = showLoans || showRecent || showWanted;
  // Every section after the first is set off by a rule
  const divided = "mt-8 border-t border-stone-200 dark:border-stone-800 pt-6";
  return (
    <main className="px-4 md:px-8 pt-4 md:pt-8 pb-8 md:pb-10">
      <h1 className="sr-only">Home</h1>
      {setupDone ? null : (
        <Welcome
          bookCount={ownCount}
          borrowingCount={books.borrowed.length}
          waitingCount={waiting.length}
          friendBookCount={friendBookCount}
          friendCount={friendIds.length}
          requestsSent={requestsSent}
          nameCount={nameCount}
          groups={groups}
          inviteUrl={inviteUrl}
          sharesShelf={sharesShelf}
          divided={showMain || showFeed}
        />
      )}

      <div
        className={`grid gap-10 lg:gap-0 ${
          showMain && showFeed ? "lg:grid-cols-[minmax(0,1fr)_23rem]" : ""
        }`}
      >
        {showMain ? (
          // min-w-0, so a long line truncates instead of widening the page
          <div className={`min-w-0 ${showFeed ? "lg:pr-10" : ""}`}>
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
                rank:
                  books.borrowed.length + books.lent.length + waiting.length > 0
                    ? 0
                    : 10,
                render: (first: boolean) =>
                  books.borrowed.length + books.lent.length + waiting.length === 0 ? (
                    // Nothing out either way: one line, not two empty lists
                    <section aria-labelledby="loans" className={first ? undefined : divided}>
                      <h2 id="loans" className={`${sectionHeading} mb-1`}>
                        Borrowing and lending
                      </h2>
                      <p className="text-sm text-stone-500 dark:text-stone-400">
                        Nothing out either way. Borrow from{" "}
                        <Link
                          to="/friends/books"
                          className="text-stone-700 dark:text-stone-200 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-900 dark:hover:text-stone-100"
                        >
                          friends&apos; shelves
                        </Link>
                        , or lend one of yours from its page.
                      </p>
                    </section>
                  ) : (
                  // No heading of its own: Borrowing and Lent out say it
                  <section
                    aria-label="Loans"
                    className={first ? undefined : divided}
                  >
                    <div className="grid gap-8 sm:grid-cols-2 sm:gap-10">
                      <LoanList
                        id="borrowing"
                        title="Borrowing"
                        icon={<BorrowedIcon size={18} />}
                        to="/books?status=borrowed"
                        books={books.borrowed
                          .slice(0, LOANS_SHOWN)
                          .map((book) => ({
                            book,
                            person: book.owner,
                            // The cue to hand it on when you're done
                            note: book.nextInLine
                              ? `${book.nextInLine} is waiting for it`
                              : null,
                          }))}
                        total={books.borrowed.length}
                        personLabel="From"
                        empty="Nothing borrowed right now."
                      >
                        {waiting.length > 0 ? (
                          <>
                            <h3 className="mt-4 mb-1 text-sm font-semibold text-stone-500 dark:text-stone-400">
                              In line for
                            </h3>
                            <LoanRows
                              personLabel="From"
                              entries={waiting.slice(0, LOANS_SHOWN).map(({ book, owner, place }) => ({
                                book,
                                person: owner,
                                line: `${owner.firstname}'s copy · ${place === 1 ? "you're next" : `${ordinal(place)} in line`}`,
                              }))}
                            />
                          </>
                        ) : null}
                      </LoanList>
                      <LoanList
                        id="lent-out"
                        title="Lent out"
                        icon={<LentIcon size={18} />}
                        to="/books?status=lent"
                        books={books.lent
                          .slice(0, LOANS_SHOWN)
                          .map((book) => ({ book, person: book.borrower }))}
                        total={books.lent.length}
                        personLabel="To"
                        empty="Everything's on your shelf."
                      />
                    </div>
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
                        <Link to="/want-to-read" className={headingLink}>
                          Want to read
                        </Link>
                      </h2>
                      <AddButton to="/search?for=want" search>
                        Find books
                      </AddButton>
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
                      // The heading's button finds them, so just what it's for
                      <p className="text-sm text-stone-500 dark:text-stone-400">
                        Books you&apos;d like to read go here, and you&apos;ll
                        hear when a friend has one.
                      </p>
                    )}
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
                        <Link to="/books" className={headingLink}>
                          Recently added
                        </Link>
                      </h2>
                      {/* Until there's one, the empty slot below is the way to add */}
                      {books.recent.length > 0 ? (
                        <AddButton to="/search">Add books</AddButton>
                      ) : null}
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
                      <ul className="grid grid-cols-4 gap-3 sm:grid-cols-5">
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
                        <li className="col-span-3 self-center text-sm text-stone-500 dark:text-stone-400 sm:col-span-4">
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
                ? "border-t border-stone-200 dark:border-stone-800 pt-8 lg:border-t-0 lg:border-l lg:pt-0"
                : undefined
            }
          >
            {/* The latest few, like the loans beside them, and the way to the rest */}
            <div className={showMain ? "lg:pl-8" : undefined}>
              <h2 id="friend-activity" className={`${sectionHeading} mb-2`}>
                <Link to="/feed" className={headingLink}>
                  Friend activity
                </Link>
              </h2>
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
              {activity.length > 0 ? (
                <MoreLink to="/feed" className="mt-3">
                  See more
                </MoreLink>
              ) : null}
            </div>
            {popular.length > 0 ? (
              <PopularChart
                popular={popular}
                className={showMain ? "lg:pl-8" : ""}
              />
            ) : null}
          </aside>
        ) : null}
      </div>
    </main>
  );
}
