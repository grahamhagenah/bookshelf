import { useEffect, useState } from "react";
import { Link, NavLink, useSearchParams } from "react-router";

import { coverSizeOf, coverSrc, libraryViewOf, useOptionalUser } from "~/utils";

import BookCover from "./book-cover";
import {
  SearchIcon,
  BookIcon,
  BorrowedIcon,
  HeartIcon,
  LentIcon,
  ReadIcon,
} from "./icons";
import ShareShelfButton from "./share-shelf-button";
import SharedWith from "./shared-with";
import type { Member } from "./shared-with";
import { sectionHeading } from "./ui";

const OPEN_LIBRARY_SIZE = /-[SML]\.jpg$/;

// Open Library serves each cover as S (~45px wide), M (~180px) and L (~400px+).
// Grid tiles are ~150px wide, so M is enough on standard screens; listing L as
// a 2x candidate lets high-density screens fetch it without slowing others down.
function getCoverSources(original: string) {
  const url = coverSrc(original);
  if (!OPEN_LIBRARY_SIZE.test(url)) return { src: url };
  return {
    src: url.replace(OPEN_LIBRARY_SIZE, "-M.jpg"),
    srcSet: `${url.replace(OPEN_LIBRARY_SIZE, "-M.jpg")} 180w, ${url.replace(OPEN_LIBRARY_SIZE, "-L.jpg")} 400w`,
  };
}

// The grid for each cover size in the account settings, and how wide a
// cover is in it, so the browser picks the right image
export const GRIDS = {
  large: {
    columns: "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6",
    sizes: "(min-width: 768px) 170px, (min-width: 640px) 22vw, 31vw",
  },
  small: {
    columns: "grid-cols-4 sm:grid-cols-5 md:grid-cols-7 lg:grid-cols-8",
    sizes: "(min-width: 768px) 125px, (min-width: 640px) 18vw, 23vw",
  },
};

interface Book {
  id: string;
  title: string;
  cover: string;
  author?: string;
  datePublished?: string | null;
  pageCount?: number | null;
  lendCount?: number;
  isBorrowed?: boolean;
  isLending?: boolean;
  // Your own copy you're not lending for now
  notLending?: boolean;
  loveCount?: number;
  borrowerId?: string | null;
  readAt?: string | Date | null;
  // First name of the housemate who added it, when it wasn't you
}

type Status =
  | "all"
  | "shelf"
  | "available"
  | "lent"
  | "borrowed"
  | "loved"
  | "read"
  | "unread";

const isLent = (book: Book) =>
  !book.isBorrowed && (book.isLending ?? Boolean(book.borrowerId));

const STATUS_TESTS: Record<Status, (book: Book) => boolean> = {
  all: () => true,
  shelf: (book) => !book.isBorrowed && !isLent(book),
  available: (book) => !isLent(book),
  lent: isLent,
  borrowed: (book) => Boolean(book.isBorrowed),
  loved: (book) => (book.loveCount ?? 0) > 0,
  // Read or not applies to your own copies
  read: (book) => !book.isBorrowed && Boolean(book.readAt),
  unread: (book) => !book.isBorrowed && !book.readAt,
};

// Your own library and someone else's shelf offer different filters
const OWN_STATUSES: [Status, string][] = [
  ["all", "All"],
  ["shelf", "On my shelf"],
  ["lent", "Lent out"],
  ["borrowed", "Borrowed"],
  ["read", "Read"],
  ["unread", "Not read"],
  ["loved", "Loved"],
];
const OTHER_STATUSES: [Status, string][] = [
  ["all", "All"],
  ["available", "Available"],
  ["lent", "Lent out"],
  ["loved", "Loved"],
];

interface LibraryProps {
  bookListItems: Book[];
  ownerName?: string; // If provided, this is someone else's library (friend or public)
  // Shown above everything else, such as the tabs between your library
  // and your want-to-read list
  header?: React.ReactNode;
  // Your library, when it's a shelf you share: shown here on phones, where
  // the tabs leave no room
  sharedWith?: { members: Member[]; viewerId: string } | null;
  // Books already shown above the grid (a public page's favorites): left
  // out while browsing, so nothing shows twice, and back in any search or
  // filter, so those still find them
  shownAbove?: string[];
}

// The grid's cover, with a 2x candidate for sharp screens
export function GridCover({
  cover,
  title,
  author,
  className,
  sizes,
  eager = false,
}: {
  cover: string;
  title: string;
  author?: string;
  className?: string;
  sizes: string;
  eager?: boolean;
}) {
  const { src, srcSet } = getCoverSources(cover);
  return (
    <BookCover
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      title={title}
      author={author}
      alt={title}
      className={className}
      eager={eager}
    />
  );
}

export default function Library({
  bookListItems,
  ownerName,
  header,
  sharedWith,
  shownAbove = [],
}: LibraryProps) {
  // Set on the account page, and the same on every shelf you look at
  const viewer = useOptionalUser();
  const viewMode = libraryViewOf(viewer);
  const grid = GRIDS[coverSizeOf(viewer)];

  const [query, setQuery] = useState("");
  // A link can open on one filter, like home's Lent out (?status=lent)
  const [searchParams] = useSearchParams();
  const linked = searchParams.get("status");
  const statusFromLink = (ownerName ? OTHER_STATUSES : OWN_STATUSES).some(
    ([value]) => value === linked,
  )
    ? (linked as Status)
    : "all";
  const [status, setStatus] = useState<Status>(statusFromLink);
  useEffect(() => setStatus(statusFromLink), [statusFromLink]);

  const statuses = (ownerName ? OTHER_STATUSES : OWN_STATUSES)
    .map(([value, label]) => ({
      value,
      label,
      count: bookListItems.filter(STATUS_TESTS[value]).length,
    }))
    // Hide filters that would show nothing, or the same as All
    .filter(
      ({ value, count }) =>
        value === "all" || (count > 0 && count < bookListItems.length),
    );

  const term = query.trim().toLowerCase();
  const visibleBooks = bookListItems
    .filter(STATUS_TESTS[status])
    .filter(
      (book) =>
        !term ||
        book.title.toLowerCase().includes(term) ||
        (book.author ?? "").toLowerCase().includes(term),
    );
  const isFiltered = Boolean(term) || status !== "all";
  // Browsing, the books above don't come round again, unless they're all
  // there is
  const notAbove = visibleBooks.filter((book) => !shownAbove.includes(book.id));
  const shelfBooks =
    !isFiltered && notAbove.length > 0 ? notAbove : visibleBooks;
  const showMarks = !ownerName && visibleBooks.some((book) => book.readAt);

  return (
    <>
      {bookListItems.length === 0 && ownerName ? (
        // Empty state for viewing someone else's library
        <main className="min-h-[calc(100vh-60px)]">
          <section className="flex flex-col items-center justify-center min-h-[calc(100vh-60px)] px-4 py-12">
            <div className="text-center">
              <BookIcon size={64} className="mx-auto text-stone-300 mb-6" />
              <h1 className="text-2xl md:text-3xl font-semibold text-stone-700 dark:text-stone-200 mb-2">
                No books yet
              </h1>
              <p className="text-stone-500 dark:text-stone-400">
                {ownerName} hasn&apos;t added any books to their library.
              </p>
            </div>
          </section>
        </main>
      ) : bookListItems.length === 0 ? (
        // Your own library, still empty: where books come from, in the
        // page's usual place under the tabs. Finding friends and sharing
        // are the home page's welcome steps.
        <main className="mt-8 md:mt-10 px-4 md:px-8 pb-8">
          {header}
          <section className="rounded-xl border border-stone-200 dark:border-stone-800 px-6 py-12 text-center">
            <BookIcon
              size={28}
              className="mx-auto text-stone-400 dark:text-stone-500"
            />
            <h1 className={`${sectionHeading} mt-3`}>
              Your library is empty
            </h1>
            <p className="mx-auto mt-1 max-w-sm text-stone-500 dark:text-stone-400">
              Add the books you own, and friends can see what they could borrow.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Link
                to="/search"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-forest-600 px-4 text-sm font-medium text-white hover:bg-forest-700 transition-colors"
              >
                <span aria-hidden="true" className="text-base leading-none">
                  +
                </span>
                Add books
              </Link>
              <Link
                to="/import"
                className="inline-flex h-9 items-center rounded-md border border-stone-200 dark:border-stone-700 px-4 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors"
              >
                Import from Goodreads
              </Link>
            </div>
          </section>
        </main>
      ) : (
        <main className="mt-8 md:mt-10 px-4 md:px-8 pb-8">
          {header}
          {/* Filter bar: find, narrow and switch views, in one line on
              wider screens. On phones the pills drop to a second line of
              their own (and scroll if they run out of room) */}
          <div className="mb-6 flex flex-wrap md:flex-nowrap items-center gap-2">
            <div className="relative min-w-0 flex-1 md:w-56 md:flex-none">
              <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400">
                <SearchIcon size={14} />
              </div>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter books"
                aria-label="Filter by title or author"
                className="h-8 w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 pl-8 pr-2 text-sm placeholder:text-stone-400 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10"
              />
            </div>
            {statuses.length > 1 ? (
              <div
                className="order-last w-full md:order-none md:w-auto flex gap-1.5 overflow-x-auto min-w-0 [scrollbar-width:none]"
                role="group"
                aria-label="Show"
              >
                {statuses.map(({ value, label, count }) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={status === value}
                    onClick={() => setStatus(value)}
                    className={`flex-shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-sm transition-colors ${
                      status === value
                        ? "bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                        : "text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900 hover:text-stone-800 dark:hover:text-stone-200"
                    }`}
                  >
                    {label}
                    <span className="ml-1.5 font-normal text-stone-400 dark:text-stone-500">
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {ownerName ? null : (
              <Link
                to="/search"
                className="ml-auto inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-700 px-3 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
              >
                <span
                  aria-hidden="true"
                  className="text-base leading-none text-stone-400 dark:text-stone-500"
                >
                  +
                </span>
                Add books
              </Link>
            )}
            {ownerName ? null : (
              <div className="flex items-center gap-2 sm:hidden">
                {sharedWith ? <SharedWith {...sharedWith} compact /> : null}
                <ShareShelfButton iconOnly />
              </div>
            )}
          </div>

          {shelfBooks.length === 0 ? (
            <div className="py-16 text-center text-stone-500 dark:text-stone-400">
              <p>No books match.</p>
              {isFiltered ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setStatus("all");
                  }}
                  className="mt-2 text-sm text-stone-700 dark:text-stone-200 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600"
                >
                  Clear filters
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Cover View */}
          {viewMode === "cover" ? (
            <ol className={`grid gap-3 sm:gap-4 ${grid.columns}`}>
              {shelfBooks.map((book, index) => (
                <li key={book.id}>
                  <NavLink to={`/books/${book.id}`} className="group block">
                    <div className="relative">
                      <GridCover
                        cover={book.cover}
                        eager={index < 7}
                        sizes={grid.sizes}
                        title={book.title}
                        author={book.author}
                        className="w-full aspect-[2/3] transition-opacity duration-200 group-hover:opacity-90"
                      />
                      {/* Where the copy is, as a small tag on the cover itself */}
                      {book.isBorrowed || book.isLending ? (
                        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded bg-white/95 dark:bg-stone-950/90 px-1.5 py-0.5 text-[11px] leading-4 text-stone-700 dark:text-stone-200 shadow-sm">
                          {book.isBorrowed ? (
                            <BorrowedIcon size={11} />
                          ) : (
                            <LentIcon size={11} />
                          )}
                          {book.isBorrowed ? "Borrowed" : "Lent out"}
                        </span>
                      ) : book.notLending ? (
                        <span className="absolute left-1.5 top-1.5 inline-flex items-center rounded bg-white/95 dark:bg-stone-950/90 px-1.5 py-0.5 text-[11px] leading-4 text-stone-500 dark:text-stone-400 shadow-sm">
                          Not lending
                        </span>
                      ) : null}
                    </div>
                    <span className="mt-1.5 flex items-center gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate text-stone-700 dark:text-stone-300">
                        {book.title}
                      </span>
                      {book.loveCount ? (
                        <span
                          className="inline-flex flex-shrink-0 items-center gap-1 text-xs text-stone-400 dark:text-stone-500"
                          title={`${book.loveCount} ${book.loveCount === 1 ? "reader loved" : "readers loved"} this`}
                        >
                          <HeartIcon
                            size={11}
                            filled
                            className="text-rose-400"
                          />
                          {book.loveCount}
                        </span>
                      ) : null}
                    </span>
                    {/* Read. The line is kept (empty if need be) whenever any
                        book has one, so the rows line up. On a shared shelf
                        every copy is everyone's, so no owner's name */}
                    {showMarks ? (
                      <span className="mt-0.5 flex h-4 items-center text-xs text-stone-400 dark:text-stone-500">
                        {book.readAt ? (
                          <span className="inline-flex items-center gap-1">
                            <ReadIcon size={11} />
                            Read
                          </span>
                        ) : null}
                      </span>
                    ) : null}
                  </NavLink>
                </li>
              ))}
            </ol>
          ) : null}

          {/* List View */}
          {viewMode === "list" ? (
            <ol className="border-t border-stone-100 dark:border-stone-800">
              {shelfBooks.map((book) => (
                <li
                  key={book.id}
                  className="border-b border-stone-100 dark:border-stone-800"
                >
                  <NavLink
                    to={`/books/${book.id}`}
                    className="flex items-center gap-3 px-2 py-2.5 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
                  >
                    <div className="flex-grow min-w-0">
                      <span className="font-medium text-stone-900 dark:text-stone-100">
                        {book.title}
                      </span>
                      {book.author ? (
                        <span className="text-stone-400 dark:text-stone-500">
                          {" "}
                          ·{" "}
                        </span>
                      ) : null}
                      {book.author ? (
                        <span className="text-stone-500 dark:text-stone-400">
                          {book.author}
                        </span>
                      ) : null}
                      {book.datePublished ? (
                        <span className="text-stone-400 dark:text-stone-500">
                          {" "}
                          ·{" "}
                        </span>
                      ) : null}
                      {book.datePublished ? (
                        <span className="text-stone-400 dark:text-stone-500">
                          {book.datePublished}
                        </span>
                      ) : null}
                      {book.pageCount ? (
                        <span className="text-stone-400 dark:text-stone-500">
                          {" "}
                          ·{" "}
                        </span>
                      ) : null}
                      {book.pageCount ? (
                        <span className="text-stone-400 dark:text-stone-500">
                          {book.pageCount} pages
                        </span>
                      ) : null}
                      {book.lendCount !== undefined && book.lendCount > 0 ? (
                        <span className="text-stone-400 dark:text-stone-500">
                          {" "}
                          ·{" "}
                        </span>
                      ) : null}
                      {book.lendCount !== undefined && book.lendCount > 0 ? (
                        <span className="text-stone-400 dark:text-stone-500">
                          lent {book.lendCount}×
                        </span>
                      ) : null}
                    </div>
                    {book.loveCount ? (
                      <span className="inline-flex items-center gap-1 text-xs text-stone-400 dark:text-stone-500 flex-shrink-0">
                        <HeartIcon size={11} filled className="text-rose-400" />
                        {book.loveCount}
                      </span>
                    ) : null}
                    {book.readAt && !ownerName && !book.isBorrowed ? (
                      <span className="inline-flex items-center gap-1 text-xs text-stone-400 dark:text-stone-500 flex-shrink-0">
                        <ReadIcon size={11} />
                        Read
                      </span>
                    ) : null}
                    {book.isBorrowed ? (
                      <span className="bg-stone-900 dark:bg-stone-100 text-white text-xs px-2 py-1 rounded-full flex-shrink-0 inline-flex items-center gap-1">
                        <BorrowedIcon size={12} />
                        Borrowed
                      </span>
                    ) : null}
                    {book.isLending ? (
                      <span className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs px-2 py-1 rounded-full flex-shrink-0 inline-flex items-center gap-1">
                        <LentIcon size={12} />
                        Lent out
                      </span>
                    ) : book.notLending && !book.isBorrowed ? (
                      <span className="bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 text-xs px-2 py-1 rounded-full flex-shrink-0">
                        Not lending
                      </span>
                    ) : null}
                  </NavLink>
                </li>
              ))}
            </ol>
          ) : null}
        </main>
      )}
    </>
  );
}
