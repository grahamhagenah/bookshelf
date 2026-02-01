import { NavLink, Link } from "@remix-run/react";
import { useState, useLayoutEffect, useEffect } from "react";
import { GroupIcon, SearchIcon, BookIcon, GridViewIcon, ListViewIcon } from './icons';

// Convert Open Library cover URL to different size
// Sizes: S (small ~50px), M (medium ~180px), L (large ~300px)
function getCoverUrl(url: string, size: "S" | "M" | "L" = "M"): string {
  return url.replace(/-[SML]\.jpg$/, `-${size}.jpg`);
}

// Generate a consistent color based on a string hash
function getColorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  // Use hue from hash, with pleasant saturation and lightness
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 40%, 80%)`;
}

type ViewMode = "cover" | "list";

interface Book {
  id: string;
  title: string;
  cover: string;
  author?: string;
  isBorrowed?: boolean;
  isLending?: boolean;
}

interface LibraryProps {
  bookListItems: Book[];
  ownerName?: string; // If provided, this is someone else's library (friend or public)
}

// Simple progressive image component with native lazy loading
function BookCover({ src, alt, className, style }: { src: string; alt: string; className?: string; style?: React.CSSProperties }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const placeholderColor = getColorFromString(src || alt);

  if (error) {
    return (
      <div
        className={className}
        style={{ ...style, backgroundColor: placeholderColor }}
      />
    );
  }

  return (
    <div className={`relative ${className}`} style={style}>
      {!loaded && (
        <div
          className="absolute inset-0 rounded-lg"
          style={{ backgroundColor: placeholderColor }}
        />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`w-full h-full object-cover rounded-lg ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}

export default function Library({ bookListItems, ownerName }: LibraryProps) {
  const [viewMode, setViewMode] = useState<ViewMode | null>(null);
  const isHydrated = viewMode !== null;

  // Load saved preference from localStorage using useLayoutEffect to prevent flash
  // useLayoutEffect runs synchronously before browser paint
  const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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
            <BookIcon size={64} className="mx-auto text-gray-300 mb-6" />
            <h1 className="text-2xl md:text-3xl font-semibold text-gray-700 mb-2">
              No books yet
            </h1>
            <p className="text-gray-500">
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
            <h1 className="text-4xl md:text-6xl font-bold text-gray-800 mb-4">
              Welcome to your <span className="text-blue-600">lending library</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Build your personal book collection, connect with friends, and share the joy of reading together.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border p-8 max-w-3xl w-full">
            <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Here&apos;s how it works</h2>
            <ol className="space-y-4">
              <li>
                <Link
                  to="/search"
                  className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-all group"
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 font-bold text-xl group-hover:bg-blue-200 transition-colors">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-800">Add books to your library</h3>
                    <p className="text-gray-600">Search for books by title or author and add them to your collection</p>
                  </div>
                  <SearchIcon size={32} className="text-blue-400 group-hover:text-blue-600 transition-colors" />
                </Link>
              </li>
              <li>
                <Link
                  to="/friends"
                  className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-all group"
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 font-bold text-xl group-hover:bg-blue-200 transition-colors">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-800">Connect with friends</h3>
                    <p className="text-gray-600">Find friends by email and see what books they have available</p>
                  </div>
                  <GroupIcon size={32} className="text-blue-400 group-hover:text-blue-600 transition-colors" />
                </Link>
              </li>
              <li>
                <Link
                  to="/account"
                  className="flex items-center gap-4 p-4 rounded-xl border-2 border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-all group"
                >
                  <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 text-blue-600 font-bold text-xl group-hover:bg-blue-200 transition-colors">
                    3
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-gray-800">Share your bookshelf</h3>
                    <p className="text-gray-600">Generate a public link so anyone can browse your collection</p>
                  </div>
                  <BookIcon size={32} className="text-blue-400 group-hover:text-blue-600 transition-colors" />
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
        {/* View Toggle - Fixed bottom right */}
        <div className="fixed bottom-4 right-4 z-50">
          <div className="inline-flex rounded-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border border-gray-200 dark:border-gray-700 p-0.5 shadow-sm">
            <button
              onClick={() => handleViewChange("cover")}
              className={`w-8 h-8 rounded-full transition-colors flex items-center justify-center ${
                viewMode === "cover"
                  ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
              title="Cover view"
            >
              <GridViewIcon size={18} />
            </button>
            <button
              onClick={() => handleViewChange("list")}
              className={`w-8 h-8 rounded-full transition-colors flex items-center justify-center ${
                viewMode === "list"
                  ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                  : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              }`}
              title="List view"
            >
              <ListViewIcon size={18} />
            </button>
          </div>
        </div>

        {/* Cover View */}
        {viewMode === "cover" && (
          <ol className="grid grid-cols-3 gap-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-8">
            {bookListItems.map((book) => (
              <li key={book.id} className="cover-wrapper relative">
                <NavLink to={`/books/${book.id}`}>
                  <BookCover
                    src={getCoverUrl(book.cover, "M")}
                    alt={book.title}
                    className="shadow-xl book-cover w-full aspect-[2/3]"
                  />
                  {book.isBorrowed && (
                    <span className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full shadow">
                      Borrowed
                    </span>
                  )}
                  {book.isLending && (
                    <span className="absolute top-2 right-2 bg-orange-600 text-white text-xs px-2 py-1 rounded-full shadow">
                      Lending
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ol>
        )}

        {/* List View */}
        {viewMode === "list" && (
          <ol className="space-y-2">
            {bookListItems.map((book) => (
              <li key={book.id}>
                <NavLink
                  to={`/books/${book.id}`}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors border border-gray-100 dark:border-gray-800"
                >
                  <BookCover
                    src={getCoverUrl(book.cover, "S")}
                    alt={book.title}
                    className="shadow w-12 h-16 flex-shrink-0"
                  />
                  <div className="flex-grow min-w-0">
                    <p className="truncate">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{book.title}</span>
                      {book.author && (
                        <span className="text-gray-400 dark:text-gray-500"> · <span className="text-gray-500 dark:text-gray-400">{book.author}</span></span>
                      )}
                    </p>
                  </div>
                  {book.isBorrowed && (
                    <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full flex-shrink-0">
                      Borrowed
                    </span>
                  )}
                  {book.isLending && (
                    <span className="bg-orange-600 text-white text-xs px-2 py-1 rounded-full flex-shrink-0">
                      Lending
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ol>
        )}
      </main>
    )}
  </>
  );
}
