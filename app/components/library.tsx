import { NavLink, Link } from "@remix-run/react";
import { useState, useLayoutEffect, useEffect } from "react";

import { coverSrc } from "~/utils";

import CoverPlaceholder from "./cover-placeholder";
import {
  GroupIcon,
  SearchIcon,
  BookIcon,
  GridViewIcon,
  BorrowedIcon,
  HeartIcon,
  LentIcon,
  ListViewIcon,
} from "./icons";

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

// Matches the grid: 3 columns on phones, then up to 5 in the 56rem column
const COVER_SIZES = "(min-width: 768px) 160px, (min-width: 640px) 22vw, 31vw";

type ViewMode = "cover" | "list";

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
  loveCount?: number;
  borrowerId?: string | null;
}

type Status = "all" | "shelf" | "available" | "lent" | "borrowed" | "loved";

const isLent = (book: Book) =>
  !book.isBorrowed && (book.isLending ?? Boolean(book.borrowerId));

const STATUS_TESTS: Record<Status, (book: Book) => boolean> = {
  all: () => true,
  shelf: (book) => !book.isBorrowed && !isLent(book),
  available: (book) => !isLent(book),
  lent: isLent,
  borrowed: (book) => Boolean(book.isBorrowed),
  loved: (book) => (book.loveCount ?? 0) > 0,
};

// Your own library and someone else's shelf offer different filters
const OWN_STATUSES: [Status, string][] = [
  ["all", "All"],
  ["shelf", "On my shelf"],
  ["lent", "Lent out"],
  ["borrowed", "Borrowed"],
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
}

// One rounded box that clips both the image and its placeholder
function BookCover({
  cover,
  title,
  author,
  className,
  eager = false,
}: {
  cover: string;
  title: string;
  author?: string;
  className?: string;
  eager?: boolean;
}) {
  const { src, srcSet } = getCoverSources(cover);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const showCover = (img: HTMLImageElement) => {
    // Open Library answers unknown covers with a 1x1 pixel, and a broken
    // image has no width at all
    if (img.naturalWidth <= 1) setError(true);
    else setLoaded(true);
  };

  // Small corners: scans often carry a thin border, and tight corners keep
  // it reading as part of the cover rather than a clipped edge
  return (
    <div className={`relative overflow-hidden rounded-xs ring-1 ring-stone-900/5 dark:ring-white/10 ${className}`}>
      {!loaded || error ? (
        <CoverPlaceholder
          title={title}
          author={author}
          className="absolute inset-0"
        />
      ) : null}
      {!error ? (
        <img
          src={src}
          srcSet={srcSet}
          sizes={srcSet ? COVER_SIZES : undefined}
          alt={title}
          // The first row is usually on screen right away
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className={`relative w-full h-full object-cover ${loaded ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
          // A cached cover can finish loading before React hydrates and
          // attaches onLoad, so also check it once it's in the page
          ref={(img) => {
            if (img?.complete) showCover(img);
          }}
          onLoad={(e) => showCover(e.currentTarget)}
          onError={() => setError(true)}
        />
      ) : null}
    </div>
  );
}

export default function Library({ bookListItems, ownerName }: LibraryProps) {
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);
  const isHydrated = viewMode !== null;

  // Load saved preference from localStorage using useLayoutEffect to prevent flash
  // useLayoutEffect runs synchronously before browser paint
  const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

  useIsomorphicLayoutEffect(() => {
    const saved = localStorage.getItem("libraryViewMode");
    if (saved === "cover" || saved === "list") {
      setViewMode(saved);
    } else {
      setViewMode("cover");
    }
  }, []);

  // Save preference when it changes
  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("libraryViewMode", mode);
  };

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>("all");

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

  return (
    <>
      {bookListItems.length === 0 && ownerName ? (
        // Empty state for viewing someone else's library
        <main className="min-h-[calc(100vh-60px)]">
          <section className="flex flex-col items-center justify-center min-h-[calc(100vh-60px)] px-4 py-12">
            <div className="text-center">
              <BookIcon size={64} className="mx-auto text-stone-300 mb-6" />
              <h1 className="text-2xl md:text-3xl font-semibold text-stone-700 mb-2">
                No books yet
              </h1>
              <p className="text-stone-500">
                {ownerName} hasn&apos;t added any books to their library.
              </p>
            </div>
          </section>
        </main>
      ) : bookListItems.length === 0 ? (
        // Empty state for own library - show onboarding
        <main className="min-h-[calc(100vh-60px)]">
          <section className="flex flex-col items-center justify-center min-h-[calc(100vh-60px)] px-4 py-12">
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-6xl font-bold text-stone-800 mb-4">
                Welcome to your{" "}
                <span className="text-stone-900 dark:text-stone-100">
                  lending library
                </span>
              </h1>
              <p className="text-xl text-stone-600 dark:text-stone-300 max-w-2xl mx-auto">
                Add the books you own, then see what your friends have.
              </p>
              <Link
                to="/search"
                className="mt-8 inline-flex items-center gap-2 rounded-md bg-stone-700 dark:bg-stone-200 px-6 py-3 text-lg font-medium text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-stone-100 transition-colors"
              >
                <span aria-hidden="true">+</span>
                Add your first books
              </Link>
            </div>

            <div className="bg-white dark:bg-stone-900 rounded-lg shadow-soft border border-stone-200/80 dark:border-stone-800 p-8 max-w-3xl w-full">
              <h2 className="text-2xl font-semibold text-stone-800 mb-6 text-center">
                Here&apos;s how it works
              </h2>
              <ol className="space-y-4">
                <li>
                  <Link
                    to="/search"
                    className="flex items-center gap-4 p-4 rounded-lg border border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600 transition-colors group"
                  >
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-stone-100 text-stone-900 dark:text-stone-100 font-bold text-xl group-hover:bg-stone-200 transition-colors">
                      1
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-stone-800">
                        Add books to your library
                      </h3>
                      <p className="text-stone-600">
                        Search for books by title or author and add them to your
                        collection
                      </p>
                    </div>
                    <SearchIcon
                      size={32}
                      className="text-stone-400 group-hover:text-stone-900 transition-colors"
                    />
                  </Link>
                </li>
                <li>
                  <Link
                    to="/friends"
                    className="flex items-center gap-4 p-4 rounded-lg border border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600 transition-colors group"
                  >
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-stone-100 text-stone-900 dark:text-stone-100 font-bold text-xl group-hover:bg-stone-200 transition-colors">
                      2
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-stone-800">
                        Connect with friends
                      </h3>
                      <p className="text-stone-600">
                        Find friends by email and see what books they have
                        available
                      </p>
                    </div>
                    <GroupIcon
                      size={32}
                      className="text-stone-400 group-hover:text-stone-900 transition-colors"
                    />
                  </Link>
                </li>
                <li>
                  <Link
                    to="/account"
                    className="flex items-center gap-4 p-4 rounded-lg border border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600 transition-colors group"
                  >
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-stone-100 text-stone-900 dark:text-stone-100 font-bold text-xl group-hover:bg-stone-200 transition-colors">
                      3
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-stone-800">
                        Share your bookshelf
                      </h3>
                      <p className="text-stone-600">
                        Generate a public link so anyone can browse your
                        collection
                      </p>
                    </div>
                    <BookIcon
                      size={32}
                      className="text-stone-400 group-hover:text-stone-900 transition-colors"
                    />
                  </Link>
                </li>
              </ol>
            </div>
          </section>
        </main>
      ) : !isHydrated ? (
        // Render minimal placeholder while loading preference to prevent flash
        <main className="mt-8 md:mt-8 px-4 md:px-8 pb-8" />
      ) : (
        <main className="mt-8 md:mt-8 px-4 md:px-8 pb-8">
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
                <div className="order-last w-full md:order-none md:w-auto flex gap-1.5 overflow-x-auto min-w-0 [scrollbar-width:none]" role="group" aria-label="Show">
                  {statuses.map(({ value, label, count }) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={status === value}
                      onClick={() => setStatus(value)}
                      className={`flex-shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-sm transition-colors ${
                        status === value
                          ? "bg-stone-100 dark:bg-stone-800 font-medium text-stone-900 dark:text-stone-100"
                          : "text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900 hover:text-stone-800 dark:hover:text-stone-200"
                      }`}
                    >
                      {label}
                      <span
                        className="ml-1.5 font-normal text-stone-400 dark:text-stone-500"
                      >
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
                  <span aria-hidden="true" className="text-base leading-none text-stone-400 dark:text-stone-500">
                    +
                  </span>
                  Add books
                </Link>
              )}
              <div
                className={`${ownerName ? "ml-auto" : ""} flex flex-shrink-0 gap-1`}
                role="group"
                aria-label="View"
              >
                <button
                  onClick={() => handleViewChange("cover")}
                  aria-pressed={viewMode === "cover"}
                  className={`w-7 h-7 rounded-md transition-colors flex items-center justify-center ${
                    viewMode === "cover"
                      ? "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200"
                      : "text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
                  }`}
                  title="Cover view"
                  aria-label="Cover view"
                >
                  <GridViewIcon size={16} />
                </button>
                <button
                  onClick={() => handleViewChange("list")}
                  aria-pressed={viewMode === "list"}
                  className={`w-7 h-7 rounded-md transition-colors flex items-center justify-center ${
                    viewMode === "list"
                      ? "bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200"
                      : "text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
                  }`}
                  title="List view"
                  aria-label="List view"
                >
                  <ListViewIcon size={16} />
                </button>
              </div>
          </div>

          {visibleBooks.length === 0 ? (
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
            <ol className="grid grid-cols-3 gap-3 sm:gap-4 sm:grid-cols-4 md:grid-cols-5">
              {visibleBooks.map((book, index) => (
                <li key={book.id} className="cover-wrapper">
                  <NavLink to={`/books/${book.id}`} className="group block">
                    <BookCover
                      cover={book.cover}
                      eager={index < 5}
                      title={book.title}
                      author={book.author}
                      className="w-full aspect-[2/3] transition-opacity duration-200 group-hover:opacity-90"
                    />
                    {/* Always there, even when empty, so every row lines up */}
                    <span className="mt-1.5 flex h-4 items-center justify-between gap-2 text-xs">
                        {book.isBorrowed ? (
                          <span className="inline-flex items-center gap-1 font-medium text-stone-900 dark:text-stone-100">
                            <BorrowedIcon size={12} />
                            Borrowed
                          </span>
                        ) : book.isLending ? (
                          <span className="inline-flex items-center gap-1 text-stone-500 dark:text-stone-400">
                            <LentIcon size={12} />
                            Lent out
                          </span>
                        ) : (
                          <span />
                        )}
                        {book.loveCount ? (
                          <span
                            className="inline-flex items-center gap-1 text-stone-400 dark:text-stone-500"
                            title={`${book.loveCount} ${book.loveCount === 1 ? "reader loved" : "readers loved"} this`}
                          >
                            <HeartIcon size={11} filled className="text-rose-400" />
                            {book.loveCount}
                          </span>
                        ) : null}
                      </span>
                  </NavLink>
                </li>
              ))}
            </ol>
          ) : null}

          {/* List View */}
          {viewMode === "list" ? (
            <ol className="border-t border-stone-100 dark:border-stone-800">
              {visibleBooks.map((book) => (
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
                    {book.isBorrowed ? (
                      <span className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs px-2 py-1 rounded-full flex-shrink-0 inline-flex items-center gap-1">
                        <BorrowedIcon size={12} />
                        Borrowed
                      </span>
                    ) : null}
                    {book.isLending ? (
                      <span className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs px-2 py-1 rounded-full flex-shrink-0 inline-flex items-center gap-1">
                        <LentIcon size={12} />
                        Lent out
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
