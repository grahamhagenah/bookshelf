

import type { LoaderFunctionArgs } from "react-router";

import { isNotLending } from "~/lending";
import { getUserLibraryKeys, searchFriendsBooks } from "~/models/book.server";
import {
  catalogCandidates,
  fromSearchResult,
  onShelves,
  rememberBooks,
} from "~/models/catalog.server";
import type { CatalogEntry } from "~/models/catalog.server";
import { shelfIds } from "~/models/household.server";
import {
  openLibraryJson,
  SEARCH_MAX_AGE_MS,
} from "~/models/openlibrary-cache.server";
import { inEnglish } from "~/models/openlibrary.server";
import { getWantToReadWorks, sameWork } from "~/models/wish.server";
import { pageUrl } from "~/page-url";
import { requireUserId } from "~/session.server";
import { ENGLISH_EDITION_FIELDS, ENGLISH_EDITION_PARAMS } from "~/utils";

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
  // On your Want to read list already
  wanted: boolean;
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

// Typeahead for the search box. Friends' books and the books Stacks has
// already come across come back at once; Open Library is asked separately
// (?source=openLibrary) since it can be slow, and its answer is those
// same books with Open Library's added after.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const params = pageUrl(request).searchParams;
  const query = params.get("q")?.trim() ?? "";
  const source = params.get("source");

  if (query.length < 2) {
    return Response.json({ query, friends: [], openLibrary: [] });
  }

  const libraryKeys = new Set(await getUserLibraryKeys(await shelfIds(userId)));
  const wishes = await getWantToReadWorks(userId);
  const mine = { libraryKeys, wishes };

  if (source === "openLibrary") {
    const [known, found] = await Promise.all([
      suggestFromCatalog(query),
      suggestFromOpenLibrary(query),
    ]);
    const entries = [...known, ...found];
    const shelved = await onShelves(entries.map((entry) => entry.key));
    return Response.json({
      query,
      friends: [],
      openLibrary: ranked(query, entries, shelved).map((entry) =>
        suggestion(entry, mine),
      ),
    });
  }

  const [friendBooks, known] = await Promise.all([
    searchFriendsBooks(userId, query),
    suggestFromCatalog(query),
  ]);
  const shelved = await onShelves(known.map((entry) => entry.key));
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
    openLibrary: ranked(query, known, shelved).map((entry) =>
      suggestion(entry, mine),
    ),
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
  "key,title,author_name,author_key,cover_i,first_publish_year,number_of_pages_median,subject,edition_count";

async function searchOpenLibrary(
  q: string,
  { englishEdition }: { englishEdition: boolean },
) {
  const edition = englishEdition
    ? `&${ENGLISH_EDITION_PARAMS}&fields=${FIELDS},${ENGLISH_EDITION_FIELDS}`
    : `&fields=${FIELDS}`;
  try {
    const body = await openLibraryJson(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=40${edition}`,
      { timeoutMs: 4000, maxAgeMs: SEARCH_MAX_AGE_MS },
    );
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
// typed. Wildcard matches lead; whichever answers in time is used. What
// it finds is remembered, so it's there at once the next time.
async function suggestFromOpenLibrary(query: string): Promise<CatalogEntry[]> {
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
  const found = [
    ...prefixed.map((doc) => plainByKey.get(doc.key) ?? doc),
    ...plain,
  ]
    .map(fromSearchResult)
    .filter((entry) => entry !== null)
    .filter((entry) => matchesTyped(query, entry.title, entry.author));
  await rememberBooks(found);
  return found;
}

// The books Stacks has come across that match
async function suggestFromCatalog(query: string): Promise<CatalogEntry[]> {
  return (await catalogCandidates(words(query))).filter((entry) =>
    matchesTyped(query, entry.title, entry.author),
  );
}

// One suggestion per book (editions repeat: by work, and by title and
// author), at most five. A title that is, or begins with, exactly what's
// typed, a leading "The" aside, goes first ("circe" → Circe, not Circeo or
// books by authors called Circe); then books on someone's shelf here; then the most widely
// read, by how many editions there are. So the list reads the same
// whether Open Library has answered yet or not, only longer once it has.
function ranked(query: string, entries: CatalogEntry[], shelved: Set<string>) {
  const seen = new Set<string>();
  const unique = entries.filter((entry) => {
    const ids = [entry.key, `${entry.title}|${entry.author}`.toLowerCase()];
    if (ids.some((id) => seen.has(id))) return false;
    ids.forEach((id) => seen.add(id));
    return true;
  });
  // "remains of" is The Remains of the Day too
  const bare = (text: string) => text.replace(/^(the|a|an) /, "");
  const typed = bare(words(query).join(" "));
  const rank = ({ title }: CatalogEntry) => {
    const normalized = bare(words(title).join(" "));
    return normalized === typed || normalized.startsWith(`${typed} `) ? 0 : 1;
  };
  const here = (entry: CatalogEntry) => (shelved.has(entry.key) ? 0 : 1);
  return unique
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        rank(a.entry) - rank(b.entry) ||
        here(a.entry) - here(b.entry) ||
        (b.entry.editions ?? 0) - (a.entry.editions ?? 0) ||
        a.index - b.index,
    )
    .slice(0, OPEN_LIBRARY_LIMIT)
    .map(({ entry }) => entry);
}

function suggestion(
  entry: CatalogEntry,
  { libraryKeys, wishes }: { libraryKeys: Set<string>; wishes: Awaited<ReturnType<typeof getWantToReadWorks>> },
): OpenLibrarySuggestion {
  return {
    title: entry.title,
    author: entry.author,
    key: entry.key,
    coverId: entry.coverId,
    year: entry.year,
    pages: entry.pages,
    subjects: entry.subjects,
    publisher: entry.publisher,
    inLibrary: libraryKeys.has(entry.key),
    wanted: wishes.some((wish) => sameWork(wish, { title: entry.title, openLibraryKey: entry.key })),
  };
}
