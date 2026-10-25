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
  useRevalidator,
} from "@remix-run/react";
import { useEffect, useState } from "react";

import BarcodeScanner from "~/components/barcode-scanner";
import BookCover from "~/components/book-cover";
import { BookmarkIcon, CameraIcon, CheckCircleIcon } from "~/components/icons";
import SearchBox from "~/components/search-box";
import { isNotLending } from "~/lending";
import {
  createBook,
  getUserLibraryKeys,
  bookExistsInLibrary,
  searchFriendsBooks,
} from "~/models/book.server";
import { shelfIds } from "~/models/household.server";
import { fetchDescription } from "~/models/openlibrary.server";
import { addWantToRead, notifyWanters } from "~/models/wish.server";
import { LIMIT_MESSAGES, UPGRADE_PATH } from "~/plan";
import { roomForBooks } from "~/plan.server";
import type { OpenLibraryBook, OpenLibraryResults } from "~/search.server";
import { seo } from "~/seo";
import { requireUserId, getUserId } from "~/session.server";
import { cleanSubjects, editionPublisher, workPath } from "~/utils";

export const meta: MetaFunction = () => seo({ title: "Search", noindex: true });

export const handle = {
  breadcrumb: () => <span>Search</span>,
};

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

// Make GET request to Open Library API
export async function loader({ request }: LoaderFunctionArgs) {
  const userId = await getUserId(request);
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const searchType = url.searchParams.get("type") || "all";
  const language = url.searchParams.get("lang") || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  // From the want-to-read list: finding a book to read, not one you own
  const forWant = url.searchParams.get("for") === "want";

  // Get user's existing library keys to show which books are already added
  const libraryKeys = userId
    ? await getUserLibraryKeys(await shelfIds(userId))
    : [];

  // Friends' copies come first, so only look them up for the first page
  const friendBooks =
    userId && query.trim() && page === 1
      ? await searchFriendsBooks(userId, query)
      : [];

  // Open Library's results are fetched by the page once it's up
  return json({
    friendBooks,
    query: query.trim() ? query : "",
    searchType,
    language,
    page: query.trim() ? page : 1,
    libraryKeys,
    forWant,
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
      openLibraryKey:
        typeof openLibraryKey === "string" ? openLibraryKey : null,
    });
    return json({ success: true, wanted: true, addedKey: openLibraryKey });
  }

  // Check if book already exists in user's library
  if (typeof openLibraryKey === "string" && openLibraryKey.length > 0) {
    const exists = await bookExistsInLibrary(
      await shelfIds(userId),
      openLibraryKey,
    );
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
    return json(
      { success: false, limit: LIMIT_MESSAGES.books, addedKey: openLibraryKey },
      { status: 403 },
    );
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

interface FriendBook {
  id: string;
  title: string;
  author: string;
  cover: string;
  borrowerId: string | null;
  notLendingUntil: string | null;
  user: { id: string; firstname: string; surname: string };
}

function FriendBookRow({ book }: { book: FriendBook }) {
  const notLending = isNotLending(book.notLendingUntil);
  const available = book.borrowerId === null && !notLending;
  return (
    <li>
      <Link
        to={`/books/${book.id}`}
        className="flex items-center gap-3 rounded-lg -mx-2 px-2 py-2 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
      >
        <BookCover
          cover={book.cover}
          title={book.title}
          author={book.author}
          compact
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
            {available ? "Available" : notLending ? "Not lending" : "Lent out"}
          </p>
        </div>
      </Link>
    </li>
  );
}

// The page for a book that's on no shelf yet, when Open Library gives it
// a work key; otherwise the children stand as they are
function WorkLink({
  workKey,
  className,
  children,
}: {
  workKey?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const path = workPath(workKey);
  if (!path) return <span className={className}>{children}</span>;
  return (
    <Link to={path} className={className}>
      {children}
    </Link>
  );
}

// Shown while Open Library is still looking; the friends' results above
// are already on the page. Three rows in the shape of the results to
// come: a cover, a title, an author, the details, the two buttons.
function SearchingOpenLibrary() {
  const bar = "rounded bg-stone-200/80 dark:bg-stone-800";
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        Searching Open Library…
      </p>
      <ul
        className="divide-y divide-stone-100 dark:divide-stone-800 motion-safe:animate-pulse"
        aria-hidden="true"
      >
        {[0, 1, 2].map((row) => (
          <li key={row} className="flex gap-4 py-4">
            <div
              className={`${bar} h-[112px] w-[74px] flex-shrink-0 rounded-xs`}
            />
            <div className="flex-1 min-w-0 pt-1">
              <div className={`${bar} h-4 ${row === 1 ? "w-2/3" : "w-1/2"}`} />
              <div className={`${bar} mt-2.5 h-3.5 w-1/3`} />
              <div className={`${bar} mt-3 h-3 w-2/5`} />
              <div className="mt-3.5 flex gap-2">
                <div className={`${bar} h-8 w-32 rounded-md`} />
                <div className={`${bar} h-8 w-28 rounded-md`} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Open Library didn't answer: slow today, or down. Friends' copies above
// are unaffected.
function OpenLibraryDown({ onRetry }: { onRetry: () => void }) {
  return (
    <p className="py-2 text-sm text-stone-500 dark:text-stone-400">
      Open Library didn&apos;t answer. It&apos;s slow right now; give it a
      moment and{" "}
      <button
        type="button"
        onClick={onRetry}
        className="font-medium text-stone-700 dark:text-stone-200 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-900 dark:hover:text-white"
      >
        try again
      </button>
      .
    </p>
  );
}

function SearchResultItem({
  book,
  isInLibrary,
  isWanted,
  forWant = false,
}: {
  book: OpenLibraryBook;
  isInLibrary: boolean;
  isWanted: boolean;
  // From the want-to-read list: that's the button to lead with
  forWant?: boolean;
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
        {/* The cover and title open the book's own page; the buttons stay here */}
        <WorkLink workKey={book.key} className="flex-shrink-0 self-stretch">
          <BookCover
            cover={
              book.cover_i
                ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
                : null
            }
            title={book.title}
            author={author}
            className="w-[74px] h-full"
          />
        </WorkLink>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-stone-900 dark:text-stone-100 leading-snug">
            <WorkLink
              workKey={book.key}
              className="hover:underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600"
            >
              {book.title}
            </WorkLink>
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
                    : forWant
                      ? "border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500"
                      : "bg-forest-600 font-medium text-white hover:bg-forest-700"
              }`}
            >
              {isAdded || alreadyInLibrary ? (
                <CheckCircleIcon size={14} />
              ) : null}
              {isAdded
                ? "Added"
                : alreadyInLibrary
                  ? "On your shelf"
                  : isAdding
                    ? "Adding…"
                    : "Add to my shelf"}
            </button>
            {/* Don't own it? Keep an eye out for it on friends' shelves */}
            {isAdded || alreadyInLibrary ? null : wanted ? (
              <span
                className={`inline-flex items-center gap-1.5 border border-transparent px-1 py-1.5 text-sm text-stone-500 dark:text-stone-400 ${forWant ? "order-first" : ""}`}
              >
                <BookmarkIcon size={14} />
                On your want-to-read list
              </span>
            ) : (
              <button
                type="submit"
                name="intent"
                value="want"
                disabled={isWanting}
                // Leads, in green, when the list is what they came to fill
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-60 ${
                  forWant
                    ? "order-first border-transparent bg-forest-600 font-medium text-white hover:bg-forest-700"
                    : "border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500"
                }`}
              >
                <BookmarkIcon size={14} />
                {isWanting ? "Saving…" : "Want to read"}
              </button>
            )}
          </div>
          {fetcher.data &&
          "limit" in fetcher.data &&
          typeof fetcher.data.limit === "string" ? (
            <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
              {fetcher.data.limit}{" "}
              <Link
                to={UPGRADE_PATH}
                className="font-medium text-forest-700 dark:text-forest-400 underline underline-offset-2"
              >
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

  // Open Library's results come after the page, from their own route, so
  // a slow Open Library shows as a wait where the results will be rather
  // than a page that hasn't changed yet
  const openLibrary = useFetcher<OpenLibraryResults>({
    key: "open-library-search",
  });
  const resultsUrl = data.query
    ? `/api/search?${new URLSearchParams({ q: data.query, type: data.searchType, lang: data.language, page: String(data.page) })}`
    : null;
  const { load: loadResults } = openLibrary;
  useEffect(() => {
    if (resultsUrl) loadResults(resultsUrl);
  }, [resultsUrl, loadResults]);
  // What's loaded is for this search, not the one before it
  const results =
    resultsUrl &&
    openLibrary.data &&
    `/api/search?${openLibrary.data.key}` === resultsUrl
      ? openLibrary.data
      : null;
  const retryResults = () => {
    if (resultsUrl) loadResults(resultsUrl);
  };
  const [scanning, setScanning] = useState(false);

  const isSearching =
    navigation.state === "loading" &&
    navigation.location?.pathname === "/search";
  const currentQuery = searchParams.get("q") || "";
  const currentType = searchParams.get("type") || "all";
  const currentLang = searchParams.get("lang") || "";
  const currentPage = data.page || 1;
  const friendBooks = data.friendBooks ?? [];

  // Build URL for a specific page while preserving other params
  const getPageUrl = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    return `/search?${params.toString()}`;
  };

  // Generate page numbers to show
  const getPageNumbers = (totalPages: number) => {
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
        {searchParams.get("for") === "want" ? (
          <input type="hidden" name="for" value="want" />
        ) : null}
        <input type="hidden" name="lang" value={currentLang} />
      </Form>

      {!data.query ? (
        <div className="py-12 text-center max-w-md mx-auto">
          {data.forWant ? (
            <>
              <p className="text-stone-700 dark:text-stone-300">
                Find a book you&apos;d like to read.
              </p>
              <p className="mt-2 text-sm text-stone-400 dark:text-stone-500">
                Borrow it if a friend has it. Otherwise it goes on your list,
                and you&apos;ll hear when a friend gets it.
              </p>
            </>
          ) : (
            <p className="text-stone-700 dark:text-stone-300">
              Find a book on a friend&apos;s shelf, or add one to your own.
            </p>
          )}
          {/* Ways to fill a library; beside the point when filling the list */}
          {data.forWant ? null : (
            <>
              <p className="mt-6 text-sm text-stone-500 dark:text-stone-400">
                Adding a lot at once?{" "}
                <button
                  type="button"
                  onClick={() => setScanning(true)}
                  className="text-stone-800 dark:text-stone-200 underline underline-offset-2"
                >
                  Scan
                </button>{" "}
                the barcodes instead of typing.
              </p>
              <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
                On Goodreads or StoryGraph?{" "}
                <Link
                  to="/import"
                  className="text-stone-800 dark:text-stone-200 underline underline-offset-2"
                >
                  Import them
                </Link>
              </p>
            </>
          )}
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
                Add to your shelf
                {results && results.numFound > 0 ? (
                  <span className="ml-2 font-normal text-stone-400 dark:text-stone-500">
                    {results.numFound.toLocaleString()} on Open Library
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

            {!results ? (
              <SearchingOpenLibrary />
            ) : (
              <>
                {results.failed ? (
                  <OpenLibraryDown onRetry={retryResults} />
                ) : results.docs.length === 0 ? (
                  <p className="py-2 text-sm text-stone-400 dark:text-stone-500">
                    No matches on Open Library. Try fewer words or another
                    filter.
                  </p>
                ) : (
                  <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                    {results.docs.map((book, index) => (
                      <SearchResultItem
                        forWant={data.forWant}
                        key={book.key || index}
                        book={book}
                        isInLibrary={
                          book.key ? data.libraryKeys.includes(book.key) : false
                        }
                        isWanted={
                          book.key ? results.wantKeys.includes(book.key) : false
                        }
                      />
                    ))}
                  </ul>
                )}

                {results.totalPages > 1 ? (
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
                      {getPageNumbers(results.totalPages).map((page, index) =>
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
                            aria-current={
                              page === currentPage ? "page" : undefined
                            }
                          >
                            {page}
                          </Link>
                        ),
                      )}
                    </div>

                    {currentPage < results.totalPages ? (
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
              </>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
