import { inEnglish } from "~/models/openlibrary.server";
import type { getWantToReadWorks } from "~/models/wish.server";
import { ENGLISH_EDITION_FIELDS, ENGLISH_EDITION_PARAMS, tidySearchResults } from "~/utils";
import { sameWork } from "~/works";

// Searching Open Library for the search page. The page itself comes
// straight away; these results are fetched by it afterwards, so a slow
// Open Library shows as a wait, not a blank page.

export const RESULTS_PER_PAGE = 20;

export interface OpenLibraryBook {
  title: string;
  author_name?: string[];
  author_key?: string[];
  cover_i?: number;
  first_publish_year?: number;
  number_of_pages_median?: number;
  subject?: string[];
  editions?: {
    docs?: { title?: string; language?: string[]; publisher?: string[] }[];
  };
  key?: string;
  language?: string[];
  publisher?: string[];
  edition_count?: number;
}

export interface OpenLibraryResponse {
  docs: OpenLibraryBook[];
  numFound: number;
}


export interface OpenLibraryResults {
  // Which search these are for, so stale answers are told from fresh
  key: string;
  docs: OpenLibraryBook[];
  numFound: number;
  totalPages: number;
  // Results already on the want-to-read list, by work key
  wantKeys: string[];
  // Open Library didn't answer, which is not the same as no matches
  failed: boolean;
}

export const NO_RESULTS: Omit<OpenLibraryResults, "key"> = { docs: [], numFound: 0, totalPages: 0, wantKeys: [], failed: false };

// Open Library can take ten seconds or more on a slow day. The page is
// already up by then, so the wait is shown, not hidden.
const SEARCH_TIMEOUT_MS = 12000;

export async function searchOpenLibrary({
  query,
  searchType,
  language,
  page,
  wishes,
}: {
  query: string;
  searchType: string;
  language: string;
  page: number;
  wishes: Awaited<ReturnType<typeof getWantToReadWorks>>;
}): Promise<Omit<OpenLibraryResults, "key">> {
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
    // To tell a book from the summaries and box sets sold around it
    "publisher",
    "edition_count",
    ENGLISH_EDITION_FIELDS,
  ].join(",");

  // Open Library uses "language:code" syntax within the query
  const fullQuery = language ? `${query} language:${language}` : query;
  let searchQuery = "";
  switch (searchType) {
    case "title":
      searchQuery = `title=${encodeURIComponent(fullQuery)}`;
      break;
    case "author":
      // language:xxx doesn't work well with author=, so it goes in q=
      searchQuery = language
        ? `q=${encodeURIComponent(`author:${query} language:${language}`)}`
        : `author=${encodeURIComponent(query)}`;
      break;
    default:
      searchQuery = `q=${encodeURIComponent(fullQuery)}`;
  }
  const offset = (page - 1) * RESULTS_PER_PAGE;

  let data: OpenLibraryResponse;
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?${searchQuery}&limit=${RESULTS_PER_PAGE}&offset=${offset}&${ENGLISH_EDITION_PARAMS}&fields=${fields}`,
      { signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) },
    );
    const body = await res.json();
    if (!res.ok || !Array.isArray(body.docs)) throw new Error(`Open Library answered ${res.status}`);
    data = { ...body, docs: tidySearchResults(await inEnglish(body.docs)) };
  } catch {
    // Slow, down, or a query it rejects ("the"): say so
    return { ...NO_RESULTS, failed: true };
  }

  const wantKeys = data.docs
    .filter(
      (doc) =>
        doc.key &&
        wishes.some((wish) => sameWork(wish, { title: doc.title, openLibraryKey: doc.key })),
    )
    .map((doc) => doc.key as string);

  return {
    docs: data.docs,
    numFound: data.numFound,
    totalPages: Math.ceil(data.numFound / RESULTS_PER_PAGE),
    wantKeys,
    failed: false,
  };
}
