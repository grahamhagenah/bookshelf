import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import { getUserLibraryKeys, searchFriendsBooks } from "~/models/book.server";
import { requireUserId } from "~/session.server";

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
  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim() ?? "";
  const source = params.get("source");

  if (query.length < 2) {
    return json<SuggestResponse>({ query, friends: [], openLibrary: [] });
  }

  if (source === "openLibrary") {
    return json<SuggestResponse>({
      query,
      friends: [],
      openLibrary: await suggestFromOpenLibrary(
        query,
        new Set(await getUserLibraryKeys(userId)),
      ),
    });
  }

  const friendBooks = await searchFriendsBooks(userId, query);
  return json<SuggestResponse>({
    query,
    friends: friendBooks.slice(0, FRIEND_LIMIT).map((book) => ({
      id: book.id,
      title: book.title,
      author: book.author,
      owner: `${book.user.firstname} ${book.user.surname}`,
      available: book.borrowerId === null,
    })),
    openLibrary: [],
  });
};

const words = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];

// Every typed word must start a word in the title or author, so "piran"
// suggests Piranesi rather than whatever Open Library ranks first
function matchesTyped(typed: string, title: string, author: string | null) {
  const haystack = words(`${title} ${author ?? ""}`);
  return words(typed).every((word) =>
    haystack.some((candidate) => candidate.startsWith(word)),
  );
}

async function searchOpenLibrary(q: string) {
  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=40&fields=key,title,author_name,cover_i,first_publish_year,number_of_pages_median,subject,publisher`,
      { signal: AbortSignal.timeout(4000) },
    );
    if (!res.ok) return [];
    const body = await res.json();
    return Array.isArray(body.docs) ? body.docs : [];
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
    lastWord.length >= 2 ? searchOpenLibrary(`${query}*`) : [],
    searchOpenLibrary(query),
  ]);

  // Editions repeat; keep one suggestion per title and author
  const seen = new Set<string>();
  const candidates: OpenLibrarySuggestion[] = [];
  for (const doc of [...prefixed, ...plain]) {
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
      year: typeof doc.first_publish_year === "number" ? doc.first_publish_year : null,
      pages:
        typeof doc.number_of_pages_median === "number"
          ? doc.number_of_pages_median
          : null,
      subjects: Array.isArray(doc.subject) ? doc.subject.slice(0, 5).join(", ") : null,
      publisher: Array.isArray(doc.publisher) ? (doc.publisher[0] ?? null) : null,
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
    .sort((a, b) => rank(a.suggestion) - rank(b.suggestion) || a.index - b.index)
    .slice(0, OPEN_LIBRARY_LIMIT)
    .map(({ suggestion }) => suggestion);
  return suggestions;
}
