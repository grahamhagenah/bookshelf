

import type { LoaderFunctionArgs } from "react-router";

import { isNotLending } from "~/lending";
import { getUserLibraryKeys, searchFriendsBooks } from "~/models/book.server";
import { shelfIds } from "~/models/household.server";
import { inEnglish } from "~/models/openlibrary.server";
import { pageUrl } from "~/page-url";
import { requireUserId } from "~/session.server";
import {
  cleanSubjects,
  editionPublisher,
  ENGLISH_EDITION_FIELDS,
  ENGLISH_EDITION_PARAMS,
} from "~/utils";

const FRIEND_LIMIT = 4;
const OPEN_LIBRARY_LIMIT = 5;

interface OpenLibrarySuggestion {
  title: string;
  author: string | null;
  // What's needed to add the book straight from the suggestion
  key: string | null;
  coverId: number | null;
  year: number | null;
  pages: number | null;
  subjects: string | null;
  publisher: string | null;
  inLibrary: boolean;
}

interface FriendSuggestion {
  id: string;
  title: string;
  author: string;
  owner: string;
  available: boolean;
  notLending: boolean;
}

export interface SuggestResponse {
  query: string;
  friends: FriendSuggestion[];
  openLibrary: OpenLibrarySuggestion[];
}

// Typeahead for the search box. Friends' books come back at once; Open
// Library is asked separately (?source=openLibrary) since it can be slow.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const params = pageUrl(request).searchParams;
  const query = params.get("q")?.trim() ?? "";
  const source = params.get("source");

  if (query.length < 2) {
    return Response.json({ query, friends: [], openLibrary: [] });
  }

  if (source === "openLibrary") {
    return Response.json({
      query,
      friends: [],
      openLibrary: await suggestFromOpenLibrary(
        query,
        new Set(await getUserLibraryKeys(await shelfIds(userId))),
      ),
    });
  }

  const friendBooks = await searchFriendsBooks(userId, query);
  return Response.json({
    query,
    friends: friendBooks.slice(0, FRIEND_LIMIT).map((book) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      owner: `${book.user.firstname} ${book.user.surname}`,
      available:
        book.borrowerId === null && !isNotLending(book.notLendingUntil),
      notLending: isNotLending(book.notLendingUntil),
    })),
    openLibrary: [],
  });
};

const words = (text: string) =>
  text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];

// Every typed word must start a word in the title or author, so "piran"
// suggests Piranesi rather than whatever Open Library ranks first
function matchesTyped(typed: string, title: string, author: string | null) {
  const haystack = words(`${title} ${author ?? ""}`);
  return words(typed).every((word) =>
    haystack.some((candidate) => candidate.startsWith(word)),
  );
}

// Asking for the English edition (for its title and publisher) makes
// wildcard searches several times slower, so only plain ones do
const FIELDS =
  "key,title,author_name,author_key,cover_i,first_publish_year,number_of_pages_median,subject";

async function searchOpenLibrary(
  q: string,
  { englishEdition }: { englishEdition: boolean },
) {
  const edition = englishEdition
    ? `&${ENGLISH_EDITION_PARAMS}&fields=${FIELDS},${ENGLISH_EDITION_FIELDS}`
    : `&fields=${FIELDS}`;
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=40${edition}`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return [];
    const body = await res.json();
    if (!Array.isArray(body.docs)) return [];
    // Open Library's results, loosely typed as they always were here
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return await inEnglish<Record<string, any>>(body.docs);
  } catch {
    return [];
  }
}

// Open Library has no prefix search, so ask twice at once: with the last
// word as a wildcard (finds "Piranesi" from "piran", but can be slow) and as
// typed. Wildcard matches lead; whichever answers in time is used.
async function suggestFromOpenLibrary(
  query: string,
  libraryKeys: Set<string>,
): Promise<OpenLibrarySuggestion[]> {
  const lastWord = words(query).at(-1) ?? "";
  const [prefixed, plain] = await Promise.all([
    lastWord.length >= 2
      ? searchOpenLibrary(`${query}*`, { englishEdition: false })
      : [],
    searchOpenLibrary(query, { englishEdition: true }),
  ]);

  // A book both searches found takes the plain one's English details. One
  // only the wildcard found has no publisher yet; it's filled in once added.
  const plainByKey = new Map(plain.map((doc) => [doc.key, doc]));
  const ordered = [
    ...prefixed.map((doc) => plainByKey.get(doc.key) ?? doc),
    ...plain,
  ];

  // Editions repeat; keep one suggestion per title and author
  const seen = new Set<string>();
  const candidates: OpenLibrarySuggestion[] = [];
  for (const doc of ordered) {
    if (typeof doc.title !== "string") continue;
    const author: string | null = doc.author_name?.[0] ?? null;
    if (!matchesTyped(query, doc.title, author)) continue;
    const id = `${doc.title}|${author}`.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    const key: string | null = typeof doc.key === "string" ? doc.key : null;
    candidates.push({
      title: doc.title,
      author,
      key,
      coverId: typeof doc.cover_i === "number" ? doc.cover_i : null,
      year:
        typeof doc.first_publish_year === "number"
          ? doc.first_publish_year
          : null,
      pages:
        typeof doc.number_of_pages_median === "number"
          ? doc.number_of_pages_median
          : null,
      subjects: cleanSubjects(doc.subject).join(", ") || null,
      publisher: editionPublisher(doc),
      inLibrary: key ? libraryKeys.has(key) : false,
    });
  }

  // A title that is, or begins with, exactly what's typed goes first
  // ("circe" → Circe, not Circeo or books by authors called Circe); the
  // rest keep Open Library's order
  const typed = words(query).join(" ");
  const rank = ({ title }: OpenLibrarySuggestion) => {
    const normalized = words(title).join(" ");
    return normalized === typed || normalized.startsWith(`${typed} `) ? 0 : 1;
  };
  const suggestions = candidates
    .map((suggestion, index) => ({ suggestion, index }))
    .sort(
      (a, b) => rank(a.suggestion) - rank(b.suggestion) || a.index - b.index,
    )
    .slice(0, OPEN_LIBRARY_LIMIT)
    .map(({ suggestion }) => suggestion);
  return suggestions;
}
