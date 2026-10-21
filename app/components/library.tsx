import { NavLink, Link } from "@remix-run/react";
import { useState, useLayoutEffect, useEffect } from "react";

import CoverPlaceholder from "./cover-placeholder";
import {
  GroupIcon,
  SearchIcon,
  BookIcon,
  GridViewIcon,
  HeartIcon,
  ListViewIcon,
} from "./icons";

const OPEN_LIBRARY_SIZE = /-[SML]\.jpg$/;

// Open Library serves each cover as S (~45px wide), M (~180px) and L (~400px+).
// Grid tiles are ~150px wide, so M is enough on standard screens; listing L as
// a 2x candidate lets high-density screens fetch it without slowing others down.
function getCoverSources(url: string) {
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
}

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

  return (
    <div className={`relative overflow-hidden rounded-md ${className}`}>
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
          onLoad={(e) => {
            // Open Library answers unknown covers with a 1x1 pixel
            if (e.currentTarget.naturalWidth <= 1) setError(true);
            else setLoaded(true);
          }}
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
              <p className="text-xl text-stone-600 max-w-2xl mx-auto">
                Build your personal book collection, connect with friends, and
                share the joy of reading together.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border p-8 max-w-3xl w-full">
              <h2 className="text-2xl font-semibold text-stone-800 mb-6 text-center">
                Here&apos;s how it works
              </h2>
              <ol className="space-y-4">
                <li>
                  <Link
                    to="/search"
                    className="flex items-center gap-4 p-4 rounded-xl border-2 border-stone-100 hover:border-stone-400 hover:bg-stone-50 transition-all group"
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
                    className="flex items-center gap-4 p-4 rounded-xl border-2 border-stone-100 hover:border-stone-400 hover:bg-stone-50 transition-all group"
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
                    className="flex items-center gap-4 p-4 rounded-xl border-2 border-stone-100 hover:border-stone-400 hover:bg-stone-50 transition-all group"
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
          {/* Cover View */}
          {viewMode === "cover" ? (
            <ol className="grid grid-cols-3 gap-3 sm:gap-4 sm:grid-cols-4 md:grid-cols-5">
              {bookListItems.map((book, index) => (
                <li key={book.id} className="cover-wrapper">
                  <NavLink to={`/books/${book.id}`} className="group block">
                    <BookCover
                      cover={book.cover}
                      eager={index < 5}
                      title={book.title}
                      author={book.author}
                      className="w-full aspect-[2/3] transition-opacity duration-200 group-hover:opacity-90"
                    />
                    {book.isBorrowed || book.isLending || book.loveCount ? (
                      <span className="mt-1.5 flex items-center justify-between gap-2 text-xs">
                        {book.isBorrowed ? (
                          <span className="font-medium text-stone-900 dark:text-stone-100">
                            Borrowed
                          </span>
                        ) : book.isLending ? (
                          <span className="text-stone-500 dark:text-stone-400">
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
                            <HeartIcon size={11} filled />
                            {book.loveCount}
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
              {bookListItems.map((book) => (
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
                        <HeartIcon size={11} filled />
                        {book.loveCount}
                      </span>
                    ) : null}
                    {book.isBorrowed ? (
                      <span className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs px-2 py-1 rounded-full flex-shrink-0">
                        Borrowed
                      </span>
                    ) : null}
                    {book.isLending ? (
                      <span className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200 text-xs px-2 py-1 rounded-full flex-shrink-0">
                        Lent out
                      </span>
                    ) : null}
                  </NavLink>
                </li>
              ))}
            </ol>
          ) : null}

          {/* View toggle, below the books */}
          <div className="mt-8 flex justify-center gap-1">
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
        </main>
      )}
    </>
  );
}
