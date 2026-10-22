import { json } from "@remix-run/node";
import type {
  LoaderFunctionArgs,
  ActionFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import {
  useLoaderData,
  useSearchParams,
  useNavigation,
  Link,
  useFetcher,
  Form,
 useRevalidator } from "@remix-run/react";
import { useState } from "react";

import BarcodeScanner from "~/components/barcode-scanner";
import { BookmarkIcon, CameraIcon, CheckCircleIcon } from "~/components/icons";
import SearchBox from "~/components/search-box";
import {
  createBook,
  getUserLibraryKeys,
  bookExistsInLibrary,
  searchFriendsBooks,
} from "~/models/book.server";
import { shelfIds } from "~/models/household.server";
import { fetchDescription, inEnglish } from "~/models/openlibrary.server";
import {
  addWantToRead,
  getWantToReadWorks,
  notifyWanters,
} from "~/models/wish.server";
import { LIMIT_MESSAGES, UPGRADE_PATH } from "~/plan";
import { roomForBooks } from "~/plan.server";
import { seo } from "~/seo";
import { requireUserId, getUserId } from "~/session.server";
import {
  cleanSubjects,
  coverSrc,
  editionPublisher,
  ENGLISH_EDITION_FIELDS,
  ENGLISH_EDITION_PARAMS,
} from "~/utils";
import { sameWork } from "~/works";

export const meta: MetaFunction = () =>
  seo({ title: "Search", noindex: true });

export const handle = {
  breadcrumb: () => <span>Search</span>,
};

interface OpenLibraryBook {
  title: string;
  author_name?: string[];
  author_key?: string[];
  cover_i?: number;
  first_publish_year?: number;
  number_of_pages_median?: number;
  subject?: string[];
  editions?: { docs?: { title?: string; language?: string[]; publisher?: string[] }[] };
  key?: string;
  language?: string[];
}

interface OpenLibraryResponse {
  docs: OpenLibraryBook[];
  numFound: number;
}

const LANGUAGES = [
  { code: "", label: "All Languages" },
  { code: "eng", label: "English" },
  { code: "spa", label: "Spanish" },
  { code: "fra", label: "French" },
  { code: "deu", label: "German" },
  { code: "ita", label: "Italian" },
  { code: "por", label: "Portuguese" },
  { code: "rus", label: "Russian" },
  { code: "jpn", label: "Japanese" },
  { code: "chi", label: "Chinese" },
  { code: "ara", label: "Arabic" },
  { code: "hin", label: "Hindi" },
  { code: "kor", label: "Korean" },
  { code: "nld", label: "Dutch" },
  { code: "swe", label: "Swedish" },
  { code: "pol", label: "Polish" },
];

const RESULTS_PER_PAGE = 20;

// Make GET request to Open Library API
export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await getUserId(request);
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const searchType = url.searchParams.get("type") || "all";
  const language = url.searchParams.get("lang") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));

  // Get user's existing library keys to show which books are already added
  const libraryKeys = userId ? await getUserLibraryKeys(await shelfIds(userId)) : [];
  const wishes = userId ? await getWantToReadWorks(userId) : [];

  // Friends' copies come first, so only look them up for the first page
  const friendBooks =
    userId && query.trim() && page === 1
      ? await searchFriendsBooks(userId, query)
      : [];

  // Return empty results if no query
  if (!query.trim()) {
    return json({
      friendBooks,
      docs: [],
      numFound: 0,
      query: "",
      searchType,
      language,
      page: 1,
      totalPages: 0,
      libraryKeys,
      wantKeys: [],
    });
  }

  // Explicitly request the fields we need
  const fields = [
    "title",
    "author_name",
    "author_key",
    "cover_i",
    "first_publish_year",
    "number_of_pages_median",
    "subject",
    "key",
    "language",
    ENGLISH_EDITION_FIELDS,
  ].join(",");

  // Build the query with language filter if specified
  // Open Library uses "language:code" syntax within the query
  let fullQuery = query;
  if (language) {
    fullQuery = `${query} language:${language}`;
  }

  // Build search query based on type
  let searchQuery = "";
  switch (searchType) {
    case "title":
      searchQuery = `title=${encodeURIComponent(fullQuery)}`;
      break;
    case "author":
      // For author search, we need to handle language differently
      // since language:xxx doesn't work well with author= parameter
      searchQuery = language
        ? `q=${encodeURIComponent(`author:${query} language:${language}`)}`
        : `author=${encodeURIComponent(query)}`;
      break;
    default:
      searchQuery = `q=${encodeURIComponent(fullQuery)}`;
  }

  const offset = (page - 1) * RESULTS_PER_PAGE;

  // Open Library rejects some queries (e.g. "the") and can be slow or down;
  // treat any failure as no matches so friends' results still show
  let data: OpenLibraryResponse = { docs: [], numFound: 0 };
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?${searchQuery}&limit=${RESULTS_PER_PAGE}&offset=${offset}&${ENGLISH_EDITION_PARAMS}&fields=${fields}`,
      { signal: AbortSignal.timeout(8000) },
    );
    const body = await res.json();
    if (res.ok && Array.isArray(body.docs)) data = { ...body, docs: await inEnglish(body.docs) };
  } catch {
    // keep the empty result
  }

  const totalPages = Math.ceil(data.numFound / RESULTS_PER_PAGE);

  // Results already on the want-to-read list, by work key or (for books
  // that came in from an import) by title
  const wantKeys = data.docs
    .filter(
      (doc) =>
        doc.key &&
        wishes.some((wish) =>
          sameWork(wish, { title: doc.title, openLibraryKey: doc.key }),
        ),
    )
    .map((doc) => doc.key as string);

  return json({
    ...data,
    friendBooks,
    query,
    searchType,
    language,
    page,
    totalPages,
    libraryKeys,
    wantKeys,
  });
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);

  const formData = await request.formData();
  const title = formData.get("title");
  const author = formData.get("author");
  const coverId = formData.get("cover");
  const cover =
    "https://covers.openlibrary.org/b/id/" + (coverId ?? "") + "-L.jpg";
  const datePublished = formData.get("datePublished");
  const pageCount = formData.get("pageCount");
  const subjects = formData.get("subjects");
  const publisher = formData.get("publisher");
  const openLibraryKey = formData.get("openLibraryKey");

  // Not on your shelf, but you'd like it to be
  if (formData.get("intent") === "want") {
    await addWantToRead(userId, {
      title: typeof title === "string" ? title : "",
      author: typeof author === "string" ? author : "",
      cover: coverId ? cover : "",
      openLibraryKey: typeof openLibraryKey === "string" ? openLibraryKey : null,
    });
    return json({ success: true, wanted: true, addedKey: openLibraryKey });
  }

  // Check if book already exists in user's library
  if (typeof openLibraryKey === "string" && openLibraryKey.length > 0) {
    const exists = await bookExistsInLibrary(await shelfIds(userId), openLibraryKey);
    if (exists) {
      return json({
        success: false,
        alreadyExists: true,
        addedKey: openLibraryKey,
      });
    }
  }

  // The free plan's shelf is full
  if ((await roomForBooks(userId)) < 1) {
    return json({ success: false, limit: LIMIT_MESSAGES.books, addedKey: openLibraryKey }, { status: 403 });
  }

  const description =
    typeof openLibraryKey === "string" && openLibraryKey.length > 0
      ? await fetchDescription(openLibraryKey)
      : "";

  const book = await createBook({
    title: typeof title === "string" ? title : "",
    author: typeof author === "string" ? author : "",
    body: description,
    cover,
    datePublished:
      typeof datePublished === "string" && datePublished.length > 0
        ? datePublished
        : null,
    pageCount:
      typeof pageCount === "string" && pageCount.length > 0
        ? parseInt(pageCount, 10)
        : null,
    subjects:
      typeof subjects === "string" && subjects.length > 0 ? subjects : null,
    publisher:
      typeof publisher === "string" && publisher.length > 0 ? publisher : null,
    openLibraryKey:
      typeof openLibraryKey === "string" && openLibraryKey.length > 0
        ? openLibraryKey
        : null,
    userId,
  });
  // Friends who wanted this one hear about it
  await notifyWanters(userId, [book]);

  return json({ success: true, addedKey: openLibraryKey });
};

function SmallCover({
  src,
  title,
  author,
  className,
}: {
  src: string | null;
  title: string;
  author: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={`relative flex-shrink-0 overflow-hidden rounded-xs shadow-sm ring-1 ring-stone-900/5 dark:ring-white/10 ${className}`}
    >
      {/* Too small for the placeholder's text; the title sits alongside */}
      <div className="absolute inset-0 bg-stone-200 dark:bg-stone-800" />
      {src && !failed ? (
        <img
          src={coverSrc(src, "M")}
          alt={`${title} by ${author}`}
          loading="lazy"
          className="relative h-full w-full object-cover"
          onLoad={(e) => {
            // Open Library answers unknown covers with a 1x1 pixel
            if (e.currentTarget.naturalWidth <= 1) setFailed(true);
          }}
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
}

interface FriendBook {
  id: string;
  title: string;
  author: string;
  cover: string;
  borrowerId: string | null;
  user: { id: string; firstname: string; surname: string };
}

function FriendBookRow({ book }: { book: FriendBook }) {
  const available = book.borrowerId === null;
  return (
    <li>
      <Link
        to={`/books/${book.id}`}
        className="flex items-center gap-3 rounded-lg -mx-2 px-2 py-2 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
      >
        <SmallCover
          src={book.cover}
          title={book.title}
          author={book.author}
          className="w-10 h-15"
        />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-stone-900 dark:text-stone-100 truncate">
            {book.title}
          </p>
          <p className="text-sm text-stone-500 dark:text-stone-400 truncate">
            {book.author}
          </p>
        </div>
        <div className="flex-shrink-0 text-right text-sm">
          <p className="text-stone-700 dark:text-stone-300">
            {book.user.firstname} {book.user.surname}
          </p>
          <p
            className={
              available
                ? "text-stone-500 dark:text-stone-400"
                : "text-stone-400 dark:text-stone-500"
            }
          >
            {available ? "Available" : "Lent out"}
          </p>
        </div>
      </Link>
    </li>
  );
}

function SearchResultItem({
  book,
  isInLibrary,
  isWanted,
}: {
  book: OpenLibraryBook;
  isInLibrary: boolean;
  isWanted: boolean;
}) {
  const fetcher = useFetcher<{
    success: boolean;
    alreadyExists?: boolean;
    wanted?: boolean;
    addedKey: string;
  }>();
  const intent = fetcher.formData?.get("intent");
  const isAdding = fetcher.state === "submitting" && intent !== "want";
  const isWanting = fetcher.state === "submitting" && intent === "want";
  const isAdded = fetcher.data?.success === true && !fetcher.data.wanted;
  const wanted = isWanted || fetcher.data?.wanted === true;
  const alreadyInLibrary = isInLibrary || fetcher.data?.alreadyExists === true;
  const author = book.author_name?.join(", ") ?? "Unknown author";
  const details = [
    book.first_publish_year,
    book.number_of_pages_median ? `${book.number_of_pages_median} pages` : null,
    editionPublisher(book),
  ].filter(Boolean);

  return (
    <li className="py-4">
      <fetcher.Form method="post" className="flex gap-4">
        <SmallCover
          src={
            book.cover_i
              ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
              : null
          }
          title={book.title}
          author={author}
          className="w-[74px] self-stretch"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 leading-snug">
            {book.title}
          </h3>
          <p className="text-stone-500 dark:text-stone-400">{author}</p>
          {details.length > 0 ? (
            <p className="mt-1 text-sm text-stone-400 dark:text-stone-500 truncate">
              {details.join(" · ")}
            </p>
          ) : null}

          <input type="hidden" name="title" value={book.title ?? ""} />
          <input
            type="hidden"
            name="author"
            value={book.author_name?.[0] ?? ""}
          />
          <input type="hidden" name="cover" value={book.cover_i ?? ""} />
          <input
            type="hidden"
            name="datePublished"
            value={book.first_publish_year?.toString() ?? ""}
          />
          <input
            type="hidden"
            name="pageCount"
            value={book.number_of_pages_median?.toString() ?? ""}
          />
          <input
            type="hidden"
            name="subjects"
            value={cleanSubjects(book.subject).join(", ")}
          />
          <input
            type="hidden"
            name="publisher"
            value={editionPublisher(book) ?? ""}
          />
          <input type="hidden" name="openLibraryKey" value={book.key ?? ""} />

          <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={isAdding || isAdded || alreadyInLibrary}
            // Every state here is the same height (the transparent border
            // matches the outlined button beside it), so the row, and the
            // cover stretched to it, never change size
            className={`inline-flex items-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-sm transition-colors ${
              isAdded || alreadyInLibrary
                ? "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 cursor-default"
                : isAdding
                  ? "bg-forest-600 text-white opacity-60 cursor-wait"
                  : "bg-forest-600 font-medium text-white hover:bg-forest-700"
            }`}
          >
            {isAdded || alreadyInLibrary ? (
              <CheckCircleIcon size={14} />
            ) : null}
            {isAdded
              ? "Added"
              : alreadyInLibrary
                ? "In your library"
                : isAdding
                  ? "Adding…"
                  : "Add to my library"}
          </button>
          {/* Don't own it? Keep an eye out for it on friends' shelves */}
          {isAdded || alreadyInLibrary ? null : wanted ? (
            <span className="inline-flex items-center gap-1.5 border border-transparent px-1 py-1.5 text-sm text-stone-500 dark:text-stone-400">
              <BookmarkIcon size={14} />
              On your want-to-read list
            </span>
          ) : (
            <button
              type="submit"
              name="intent"
              value="want"
              disabled={isWanting}
              className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-700 px-3 py-1.5 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors disabled:opacity-60"
            >
              <BookmarkIcon size={14} />
              {isWanting ? "Saving…" : "Want to read"}
            </button>
          )}
          </div>
          {fetcher.data && "limit" in fetcher.data && typeof fetcher.data.limit === "string" ? (
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
              {fetcher.data.limit}{" "}
              <Link to={UPGRADE_PATH} className="font-medium text-forest-700 dark:text-forest-400 underline underline-offset-2">
                See Stacks Plus
              </Link>
            </p>
          ) : null}
        </div>
      </fetcher.Form>
    </li>
  );
}

const selectClass =
  "h-9 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 text-sm text-stone-700 dark:text-stone-300 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10";

export default function Search() {
  const data = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [scanning, setScanning] = useState(false);

  const isSearching =
    navigation.state === "loading" &&
    navigation.location?.pathname === "/search";
  const currentQuery = searchParams.get("q") || "";
  const currentType = searchParams.get("type") || "all";
  const currentLang = searchParams.get("lang") || "";
  const currentPage = data.page || 1;
  const totalPages = data.totalPages || 0;
  const friendBooks = data.friendBooks ?? [];

  // Build URL for a specific page while preserving other params
  const getPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    return `/search?${params.toString()}`;
  };

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }

    return pages;
  };

  const pageLink =
    "px-3 py-1.5 text-sm rounded-md border border-stone-200 dark:border-stone-700 hover:border-stone-400 dark:hover:border-stone-500 transition-colors";
  const pageDisabled =
    "px-3 py-1.5 text-sm rounded-md border border-stone-100 dark:border-stone-800 text-stone-300 dark:text-stone-600 cursor-not-allowed";
  const sectionHeading =
    "text-sm font-semibold text-stone-500 dark:text-stone-400";

  return (
    <main className="w-full max-w-5xl mx-auto px-4 py-8 md:px-8 md:py-10">
      <h1 className="sr-only">Search</h1>

      {scanning ? (
        <BarcodeScanner
          onClose={() => {
            setScanning(false);
            // Anything scanned is on the shelf now; refresh the "in your library" marks
            revalidator.revalidate();
          }}
        />
      ) : null}
      <Form method="get" className="mb-10">
        {/* Phones: the box takes the whole line (its keyboard has a Search key,
            and the suggestions get the room); Scan gets its own line below */}
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <SearchBox defaultValue={currentQuery} />
          <button
            type="submit"
            disabled={isSearching}
            // Visually hidden on phones, but still there so Enter submits
            className="sr-only sm:not-sr-only sm:px-5 rounded-md bg-forest-600 text-sm font-medium text-white hover:bg-forest-700 transition-colors disabled:opacity-60"
          >
            {isSearching ? "Searching…" : "Search"}
          </button>
          {/* Scan the barcode on the back of a book instead of typing */}
          <button
            type="button"
            onClick={() => setScanning(true)}
            title="Scan a barcode"
            aria-label="Scan a barcode"
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-stone-200 dark:border-stone-700 px-3 py-2.5 text-base text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors sm:w-auto sm:py-0 sm:text-sm"
          >
            <CameraIcon size={20} />
            <span className="sm:hidden">Scan a barcode</span>
            <span className="hidden sm:inline">Scan</span>
          </button>
        </div>
        {/* Keep the Open Library filters through new searches */}
        <input type="hidden" name="type" value={currentType} />
        <input type="hidden" name="lang" value={currentLang} />
      </Form>

      {!data.query ? (
        <div className="py-12 text-center max-w-md mx-auto">
          <p className="text-stone-700 dark:text-stone-300">
            Find a book on your friends&apos; shelves, or add a new one to your
            library.
          </p>
          <p className="mt-2 text-sm text-stone-400 dark:text-stone-500">
            Search once and you&apos;ll see both.
          </p>
          <p className="mt-6 text-sm text-stone-500 dark:text-stone-400">
            Adding a stack of real books? Hit{" "}
            <button
              type="button"
              onClick={() => setScanning(true)}
              className="text-stone-800 dark:text-stone-200 underline underline-offset-2"
            >
              Scan
            </button>{" "}
            and point your phone at each barcode.
          </p>
          <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
            Already keep your books on Goodreads or StoryGraph?{" "}
            <Link
              to="/import"
              className="text-stone-800 dark:text-stone-200 underline underline-offset-2"
            >
              Import them
            </Link>
          </p>
        </div>
      ) : (
        <div className={isSearching ? "opacity-60 transition-opacity" : ""}>
          {currentPage === 1 ? (
            <section className="mb-12">
              <h2 className={`${sectionHeading} mb-2`}>
                On your friends&apos; shelves
                {friendBooks.length > 0 ? (
                  <span className="ml-2 font-normal text-stone-400 dark:text-stone-500">
                    {friendBooks.length}
                  </span>
                ) : null}
              </h2>
              {friendBooks.length > 0 ? (
                <ul>
                  {friendBooks.map((book) => (
                    <FriendBookRow key={book.id} book={book} />
                  ))}
                </ul>
              ) : (
                <p className="py-2 text-sm text-stone-400 dark:text-stone-500">
                  None of your friends have a book matching &ldquo;{data.query}
                  &rdquo;.
                </p>
              )}
            </section>
          ) : null}

          <section>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
              <h2 className={sectionHeading}>
                Add to your library
                {data.numFound > 0 ? (
                  <span className="ml-2 font-normal text-stone-400 dark:text-stone-500">
                    {data.numFound.toLocaleString()} on Open Library
                  </span>
                ) : null}
              </h2>
              <Form method="get" className="flex gap-2">
                <input type="hidden" name="q" value={currentQuery} />
                <label htmlFor="type" className="sr-only">
                  Search by
                </label>
                <select
                  id="type"
                  name="type"
                  defaultValue={currentType}
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                  className={selectClass}
                >
                  <option value="all">Title or author</option>
                  <option value="title">Title only</option>
                  <option value="author">Author only</option>
                </select>
                <label htmlFor="lang" className="sr-only">
                  Language
                </label>
                <select
                  id="lang"
                  name="lang"
                  defaultValue={currentLang}
                  onChange={(e) => e.currentTarget.form?.requestSubmit()}
                  className={selectClass}
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </Form>
            </div>

            {data.docs.length === 0 ? (
              <p className="py-2 text-sm text-stone-400 dark:text-stone-500">
                No matches on Open Library. Try fewer words or another filter.
              </p>
            ) : (
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {data.docs.map((book, index) => (
                  <SearchResultItem
                    key={book.key || index}
                    book={book}
                    isInLibrary={
                      book.key ? data.libraryKeys.includes(book.key) : false
                    }
                    isWanted={book.key ? data.wantKeys.includes(book.key) : false}
                  />
                ))}
              </ul>
            )}

            {totalPages > 1 ? (
              <nav
                className="flex justify-center items-center gap-2 py-8"
                aria-label="Pagination"
              >
                {currentPage > 1 ? (
                  <Link
                    to={getPageUrl(currentPage - 1)}
                    className={pageLink}
                    aria-label="Previous page"
                  >
                    Previous
                  </Link>
                ) : (
                  <span className={pageDisabled}>Previous</span>
                )}

                <div className="flex gap-1">
                  {getPageNumbers().map((page, index) =>
                    page === "..." ? (
                      <span
                        key={`ellipsis-${index}`}
                        className="px-2 py-1.5 text-sm text-stone-400"
                      >
                        …
                      </span>
                    ) : (
                      <Link
                        key={page}
                        to={getPageUrl(page)}
                        className={
                          page === currentPage
                            ? "px-3 py-1.5 text-sm rounded-md border bg-forest-600 text-white border-forest-600"
                            : pageLink
                        }
                        aria-current={page === currentPage ? "page" : undefined}
                      >
                        {page}
                      </Link>
                    ),
                  )}
                </div>

                {currentPage < totalPages ? (
                  <Link
                    to={getPageUrl(currentPage + 1)}
                    className={pageLink}
                    aria-label="Next page"
                  >
                    Next
                  </Link>
                ) : (
                  <span className={pageDisabled}>Next</span>
                )}
              </nav>
            ) : null}
          </section>
        </div>
      )}
    </main>
  );
}
