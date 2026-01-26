import { NavLink, Link } from "@remix-run/react";
import { useState, useLayoutEffect, useEffect } from "react";
import { GroupIcon, SearchIcon, BookIcon, GridViewIcon, ListViewIcon } from './icons';

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
    <div className="relative" style={style}>
      {!loaded && (
        <div
          className={`absolute inset-0 ${className}`}
          style={{ backgroundColor: placeholderColor }}
        />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`${className} ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        style={style}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />
    </div>
  );
}

export default function Library({ bookListItems }: LibraryProps) {
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
    {bookListItems.length === 0 ? (
    <main className="md:h-4/6 flex flex-col justify-center">
        <section id="intro">
          <div className="intro-wrapper">
            <h1 className="text-4xl md:text-6xl font-semibold mt-5">This is your <strong>lending library</strong></h1>
            <ol className="card-wrapper md:flex justify-center mx-auto mt-10 text-xl md:w-3/4 gap-4 xl:gap-8">
              <li className="md:w-1/3">
                <Link
                  to="/search"
                  className="block h-full p-6 m-4 md:m-0 rounded-xl border-2 border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <SearchIcon size={32} className="text-blue-500" />
                  <p className="mt-5">Search for books by author or title</p>
                </Link>
              </li>
              <li className="md:w-1/3">
                <Link
                  to="/friends"
                  className="block h-full p-6 m-4 md:m-0 rounded-xl border-2 border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <GroupIcon size={32} className="text-blue-500" />
                  <p className="mt-5">Add friends to see their books</p>
                </Link>
              </li>
              <li className="md:w-1/3">
                <Link
                  to="/friends"
                  className="block h-full p-6 m-4 md:m-0 rounded-xl border-2 border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <BookIcon size={32} className="text-blue-500" />
                  <p className="mt-5">Start borrowing and lending</p>
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
          <div className="inline-flex rounded-full bg-white/80 backdrop-blur-sm border border-gray-200 p-0.5 shadow-sm">
            <button
              onClick={() => handleViewChange("cover")}
              className={`w-8 h-8 rounded-full transition-colors flex items-center justify-center ${
                viewMode === "cover"
                  ? "bg-gray-200 text-gray-700"
                  : "text-gray-400 hover:text-gray-600"
              }`}
              title="Cover view"
            >
              <GridViewIcon size={18} />
            </button>
            <button
              onClick={() => handleViewChange("list")}
              className={`w-8 h-8 rounded-full transition-colors flex items-center justify-center ${
                viewMode === "list"
                  ? "bg-gray-200 text-gray-700"
                  : "text-gray-400 hover:text-gray-600"
              }`}
              title="List view"
            >
              <ListViewIcon size={18} />
            </button>
          </div>
        </div>

        {/* Cover View */}
        {viewMode === "cover" && (
          <ol className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-8">
            {bookListItems.map((book) => (
              <li key={book.id} className="cover-wrapper relative">
                <NavLink to={`/books/${book.id}`}>
                  <BookCover
                    src={book.cover}
                    alt={book.title}
                    className="rounded-lg shadow-xl book-cover h-80 w-full object-cover"
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
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                >
                  <BookCover
                    src={book.cover}
                    alt={book.title}
                    className="rounded shadow w-12 h-16 object-cover flex-shrink-0"
                  />
                  <div className="flex-grow min-w-0">
                    <p className="truncate">
                      <span className="font-medium text-gray-900">{book.title}</span>
                      {book.author && (
                        <span className="text-gray-400"> · <span className="text-gray-500">{book.author}</span></span>
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
