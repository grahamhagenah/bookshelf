import { Link } from "@remix-run/react";

import { coverSrc } from "~/utils";

import DemoButton from "./demo-button";
import { BorrowedIcon, HeartIcon, LentIcon } from "./icons";

// The signed-out home page: what Stacks is, beside a small, staged glimpse
// of the app itself (a friend asking to borrow, a few books with their
// loan status, hearts and a due date, a note from a friend, and friends'
// shelves to borrow from), so people see what they're signing up for

const cover = (isbn: string) =>
  coverSrc(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`);

interface ShowcaseBook {
  title: string;
  cover: string;
  status?: "lent" | "borrowed";
  hearts?: number;
  // Where it sits in the arrangement
  className: string;
}

const BOOKS: ShowcaseBook[] = [
  {
    title: "The Left Hand of Darkness",
    cover: cover("9780441478125"),
    status: "borrowed",
    className: "left-0 top-[26%] sm:top-[20%] -rotate-6",
  },
  {
    title: "Circe",
    cover: cover("9780316556347"),
    hearts: 3,
    className: "left-[33%] top-[19%] sm:top-[12%] z-10 rotate-1",
  },
  {
    title: "Piranesi",
    cover: cover("9781635575637"),
    status: "lent",
    hearts: 2,
    className: "right-0 top-[28%] sm:top-[22%] rotate-6",
  },
];

function BookCard({ book }: { book: ShowcaseBook }) {
  return (
    <div
      className={`absolute w-[34%] rounded-lg bg-white dark:bg-stone-900 p-2 shadow-soft ring-1 ring-stone-900/5 dark:ring-white/10 ${book.className}`}
    >
      <img
        src={book.cover}
        alt=""
        className="aspect-[2/3] w-full rounded-xs object-cover ring-1 ring-stone-900/5"
      />
      <p className="mt-1.5 truncate text-xs text-stone-700 dark:text-stone-300">
        {book.title}
      </p>
      <p className="mt-0.5 flex h-4 items-center justify-between gap-1 text-[11px]">
        {book.status === "lent" ? (
          <span className="inline-flex items-center gap-1 text-stone-500 dark:text-stone-400">
            <LentIcon size={11} />
            Lent out
          </span>
        ) : book.status === "borrowed" ? (
          <span className="inline-flex items-center gap-1 font-medium text-stone-900 dark:text-stone-100">
            <BorrowedIcon size={11} />
            Borrowed
          </span>
        ) : (
          <span />
        )}
        {book.hearts ? (
          <span className="inline-flex items-center gap-1 text-stone-400 dark:text-stone-500">
            <HeartIcon size={10} filled className="text-rose-400" />
            {book.hearts}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function Showcase() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto h-[480px] w-full max-w-[420px] select-none sm:h-[505px]"
    >
      {/* A friend asking to borrow, as it shows up in Activity */}
      <div className="absolute left-[16%] right-0 top-0 z-30 rotate-2 rounded-lg bg-white dark:bg-stone-900 p-3 shadow-soft ring-1 ring-stone-900/5 dark:ring-white/10">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-200">
            SO
          </span>
          <div className="min-w-0 pt-1.5">
            <p className="text-sm leading-snug text-stone-800 dark:text-stone-200">
              <span className="font-semibold">Sam Okafor</span> would like to
              borrow <span className="font-semibold">Circe</span>
            </p>
          </div>
        </div>
      </div>

      {BOOKS.map((book) => (
        <BookCard key={book.title} book={book} />
      ))}

      {/* When the lent-out book is due back, stuck on its corner */}
      <span className="absolute right-[-3%] top-[24%] z-30 rotate-[8deg] rounded-md bg-stone-900 px-2 py-1 text-[11px] font-medium text-white shadow-soft dark:bg-stone-100 dark:text-stone-900 sm:top-[19%]">
        With Sam · due in 5 days
      </span>

      {/* A note from a friend, laid over the books */}
      <div className="absolute bottom-[11%] left-[5%] right-[8%] z-20 -rotate-1 rounded-lg bg-white dark:bg-stone-900 p-4 shadow-soft ring-1 ring-stone-900/5 dark:ring-white/10">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-200">
            MC
          </span>
          <div className="min-w-0">
            <p className="text-sm text-stone-800 dark:text-stone-200">
              <span className="font-semibold">Maya Chen</span> wrote about{" "}
              <span className="font-semibold">Circe</span>
              <HeartIcon
                size={12}
                filled
                className="ml-1.5 inline align-[-1px] text-rose-400"
              />
            </p>
            <p className="mt-1 text-sm text-stone-600 dark:text-stone-300">
              &ldquo;Gorgeous. The chapters on Aiaia felt like a long
              summer.&rdquo;
            </p>
          </div>
        </div>
      </div>

      {/* Friends' shelves, all in one place */}
      <div className="absolute bottom-0 right-[3%] z-20 flex rotate-2 items-center gap-2.5 rounded-full bg-white dark:bg-stone-900 py-1.5 pl-1.5 pr-3.5 shadow-soft ring-1 ring-stone-900/5 dark:ring-white/10">
        <span className="flex">
          {["MC", "SO", "PP"].map((initials, index) => (
            <span
              key={initials}
              className={`flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800 text-[10px] font-semibold text-stone-700 dark:text-stone-200 ring-2 ring-white dark:ring-stone-900 ${
                index > 0 ? "-ml-1" : ""
              }`}
            >
              {initials}
            </span>
          ))}
        </span>
        <span className="text-xs text-stone-600 dark:text-stone-300">
          <span className="font-semibold text-stone-900 dark:text-stone-100">16 books</span>{" "}
          on your friends&apos; shelves
        </span>
      </div>
    </div>
  );
}

const FEATURES = [
  {
    label: "Catalog the books on your shelf",
    icon: (
      <path d="M4 19.5V5a2 2 0 012-2h13v15H6a2 2 0 00-2 2v.5A1.5 1.5 0 005.5 22H19" />
    ),
  },
  {
    label: "Lend them out and see who has what",
    icon: (
      <>
        <path d="M17 3l4 4-4 4" />
        <path d="M21 7H9" />
        <path d="M7 21l-4-4 4-4" />
        <path d="M3 17h12" />
      </>
    ),
  },
  {
    label: "Borrow from your friends' shelves",
    icon: (
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />
    ),
  },
];

export default function Landing() {
  return (
    <main className="px-4 md:px-8 pt-10 pb-16 md:pt-20 md:pb-24">
      <section className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-16">
        <div>
          <h1 className="text-5xl sm:text-6xl lg:text-[3.25rem] font-bold tracking-tight leading-[1.02] text-stone-900 dark:text-stone-50">
            Your bookshelf,
            <br />
            shared with friends.
          </h1>
          <p className="mt-5 max-w-lg text-xl sm:text-2xl leading-snug text-stone-600 dark:text-stone-300">
            Keep track of the books you own, lend them to friends, and borrow
            theirs.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link
              to="/join"
              className="inline-flex items-center justify-center rounded-md bg-stone-700 dark:bg-stone-200 px-6 py-3 text-lg font-medium text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-100 transition-colors"
            >
              Create an account
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-md ring-1 ring-inset ring-stone-300 dark:ring-stone-700 px-6 py-3 text-lg font-medium text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
            >
              Sign in
            </Link>
          </div>
          <div className="mt-6 text-base text-stone-500 dark:text-stone-400">
            <DemoButton className="text-stone-700 dark:text-stone-200 font-medium underline-offset-4 decoration-stone-300 dark:decoration-stone-600 hover:underline">
              Or look around a demo library first →
            </DemoButton>
          </div>
        </div>

        <Showcase />
      </section>

      <ul className="mt-16 grid gap-6 border-t border-stone-200 dark:border-stone-800 pt-8 text-stone-600 dark:text-stone-300 sm:grid-cols-3 md:mt-24">
        {FEATURES.map(({ label, icon }) => (
          <li key={label} className="flex items-center gap-3">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="flex-shrink-0 text-stone-500 dark:text-stone-400"
            >
              {icon}
            </svg>
            {label}
          </li>
        ))}
      </ul>
    </main>
  );
}
