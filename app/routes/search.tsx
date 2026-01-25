import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSearchParams, useNavigation } from "@remix-run/react";
import { Form } from "@remix-run/react";
import { createBook } from "~/models/book.server";
import { requireUserId } from "~/session.server";
import Breadcrumbs from "~/components/breadcrumbs";
import SearchIcon from '@mui/icons-material/Search';

export const handle = {
  breadcrumb: () => <span>Search</span>,
};

interface OpenLibraryBook {
  title: string;
  author_name?: string[];
  cover_i?: number;
  first_sentence?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  subject?: string[];
  publisher?: string[];
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

// Make GET request to Open Library API
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const searchType = url.searchParams.get("type") || "all";
  const language = url.searchParams.get("lang") || "";

  // Return empty results if no query
  if (!query.trim()) {
    return json({ docs: [], numFound: 0, query: "", searchType, language } as OpenLibraryResponse & { query: string; searchType: string; language: string });
  }

  // Explicitly request the fields we need
  const fields = [
    "title",
    "author_name",
    "cover_i",
    "first_sentence",
    "first_publish_year",
    "number_of_pages_median",
    "subject",
    "publisher",
    "key",
    "language",
  ].join(",");

  // Build search query based on type
  let searchQuery = "";
  switch (searchType) {
    case "title":
      searchQuery = `title=${encodeURIComponent(query)}`;
      break;
    case "author":
      searchQuery = `author=${encodeURIComponent(query)}`;
      break;
    default:
      searchQuery = `q=${encodeURIComponent(query)}`;
  }

  // Add language filter if specified
  if (language) {
    searchQuery += `&language=${language}`;
  }

  const res = await fetch(
    `https://openlibrary.org/search.json?${searchQuery}&limit=20&fields=${fields}`
  );
  const data = await res.json() as OpenLibraryResponse;

  return json({ ...data, query, searchType, language });
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);

  const formData = await request.formData();
  const title = formData.get("title");
  const author = formData.get("author");
  const coverId = formData.get("cover");
  const cover = "https://covers.openlibrary.org/b/id/" + (coverId ?? "") + "-M.jpg";
  const body = formData.get("body");
  const datePublished = formData.get("datePublished");
  const pageCount = formData.get("pageCount");
  const subjects = formData.get("subjects");
  const publisher = formData.get("publisher");
  const openLibraryKey = formData.get("openLibraryKey");

  await createBook({
    title: typeof title === "string" ? title : "",
    author: typeof author === "string" ? author : "",
    body: typeof body === "string" ? body : "",
    cover,
    datePublished: typeof datePublished === "string" && datePublished.length > 0 ? datePublished : null,
    pageCount: typeof pageCount === "string" && pageCount.length > 0 ? parseInt(pageCount, 10) : null,
    subjects: typeof subjects === "string" && subjects.length > 0 ? subjects : null,
    publisher: typeof publisher === "string" && publisher.length > 0 ? publisher : null,
    openLibraryKey: typeof openLibraryKey === "string" && openLibraryKey.length > 0 ? openLibraryKey : null,
    userId,
  });

  return redirect(`/books`);
};

export default function Search() {
  const data = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();

  const isSearching = navigation.state === "loading" && navigation.location?.pathname === "/search";
  const currentQuery = searchParams.get("q") || "";
  const currentType = searchParams.get("type") || "all";
  const currentLang = searchParams.get("lang") || "";

  return (
    <>
      <Breadcrumbs />
      <div id="search-container" className="w-11/12 md:w-3/4 lg:w-2/3 mx-auto mt-4">
        {/* Search Form */}
        <Form method="get" className="bg-white border rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col gap-4">
            {/* Search Input */}
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                name="q"
                defaultValue={currentQuery}
                placeholder="Search for books..."
                className="w-full pl-10 pr-4 py-3 border rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search Type */}
              <div className="flex-1">
                <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                  Search by
                </label>
                <select
                  id="type"
                  name="type"
                  defaultValue={currentType}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Fields</option>
                  <option value="title">Title</option>
                  <option value="author">Author</option>
                </select>
              </div>

              {/* Language Filter */}
              <div className="flex-1">
                <label htmlFor="lang" className="block text-sm font-medium text-gray-700 mb-1">
                  Language
                </label>
                <select
                  id="lang"
                  name="lang"
                  defaultValue={currentLang}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Button */}
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isSearching}
                  className="w-full sm:w-auto px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:bg-blue-400 disabled:bg-gray-400"
                >
                  {isSearching ? "Searching..." : "Search"}
                </button>
              </div>
            </div>
          </div>
        </Form>

        {/* Results Info */}
        {data.query && (
          <div className="mb-4 text-gray-600">
            {isSearching ? (
              <p>Searching...</p>
            ) : (
              <p>
                Found <span className="font-semibold">{data.numFound.toLocaleString()}</span> results
                for "<span className="font-semibold">{data.query}</span>"
                {currentType !== "all" && (
                  <span> in <span className="font-semibold">{currentType}s</span></span>
                )}
                {currentLang && (
                  <span> in <span className="font-semibold">{LANGUAGES.find(l => l.code === currentLang)?.label}</span></span>
                )}
              </p>
            )}
          </div>
        )}

        {/* Empty State */}
        {!data.query && (
          <div className="text-center py-16">
            <SearchIcon style={{ fontSize: 64 }} className="text-gray-300 mb-4" />
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">Search for Books</h2>
            <p className="text-gray-500 max-w-md mx-auto">
              Enter a book title, author name, or keywords to search the Open Library database
              and add books to your collection.
            </p>
          </div>
        )}

        {/* No Results */}
        {data.query && data.docs.length === 0 && !isSearching && (
          <div className="text-center py-16">
            <h2 className="text-2xl font-semibold text-gray-700 mb-2">No Results Found</h2>
            <p className="text-gray-500">
              Try adjusting your search terms or filters.
            </p>
          </div>
        )}

        {/* Results List */}
        <ul className="search-results mb-4">
          {data.docs.map((book, index) => {
            const subjectsPreview = book.subject?.slice(0, 3).join(", ") ?? "";
            return (
              <li key={index} className="border-b border-gray-200 last:border-0">
                <Form method="post" className="grid grid-cols-1 md:grid-cols-[1fr,3fr]">
                  <section className="w-full p-4">
                    <div className="book-cover">
                      {book.cover_i ? (
                        <img
                          className="rounded-md shadow-md"
                          src={`https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`}
                          alt={book.title}
                        />
                      ) : (
                        <div className="w-full h-48 bg-gray-200 rounded-md flex items-center justify-center text-gray-400">
                          No Cover
                        </div>
                      )}
                    </div>
                  </section>
                  <section className="w-full p-4">
                    <h3 className="text-2xl md:text-3xl font-bold">{book.title}</h3>
                    <h4 className="text-lg md:text-xl py-2 text-gray-700">
                      {book.author_name?.join(", ") ?? "Unknown Author"}
                    </h4>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 py-2">
                      {book.first_publish_year && (
                        <span>Published: {book.first_publish_year}</span>
                      )}
                      {book.number_of_pages_median && (
                        <span>{book.number_of_pages_median} pages</span>
                      )}
                      {book.publisher?.[0] && (
                        <span>{book.publisher[0]}</span>
                      )}
                      {book.language && book.language.length > 0 && (
                        <span className="bg-gray-100 px-2 py-0.5 rounded">
                          {book.language.slice(0, 3).join(", ")}
                        </span>
                      )}
                    </div>

                    {subjectsPreview && (
                      <p className="text-sm text-gray-500 py-1">{subjectsPreview}</p>
                    )}

                    <p className="summary py-4 text-gray-700">
                      {book.first_sentence ? book.first_sentence[0] : "No description available."}
                    </p>

                    <input type="hidden" name="title" value={book.title ?? ""} />
                    <input type="hidden" name="author" value={book.author_name?.[0] ?? ""} />
                    <input type="hidden" name="cover" value={book.cover_i ?? ""} />
                    <input type="hidden" name="body" value={book.first_sentence?.[0] ?? ""} />
                    <input type="hidden" name="datePublished" value={book.first_publish_year?.toString() ?? ""} />
                    <input type="hidden" name="pageCount" value={book.number_of_pages_median?.toString() ?? ""} />
                    <input type="hidden" name="subjects" value={book.subject?.slice(0, 5).join(", ") ?? ""} />
                    <input type="hidden" name="publisher" value={book.publisher?.[0] ?? ""} />
                    <input type="hidden" name="openLibraryKey" value={book.key ?? ""} />

                    <button
                      className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400"
                      type="submit"
                    >
                      Add to Library
                    </button>
                  </section>
                </Form>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
