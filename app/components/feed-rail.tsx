import { Link, useFetcher } from "@remix-run/react";
import { useState } from "react";

import Avatar from "./avatar";
import BookCover from "./book-cover";
import { HeartIcon } from "./icons";
import { railHeading, railLink } from "./side-rail";

// The feed's own sections in the rail beside it: books you want that a
// friend has, what friends have loved lately, and people your friends
// know. Each is left out while it has nothing to show.

const row =
  "flex items-center gap-3 rounded-md hover:opacity-80 transition-opacity";
const title = "block truncate text-sm font-medium text-stone-900 dark:text-stone-100";
const detail = "block truncate text-xs text-stone-500 dark:text-stone-400";

// "Maya", "Maya and Sam", "Maya, Sam and 2 more"
function names(people: string[]) {
  if (people.length <= 2) return people.join(" and ");
  return `${people.slice(0, 2).join(", ")} and ${people.length - 2} more`;
}

function Heading({ id, children, to, label }: {
  id: string;
  children: React.ReactNode;
  to?: string;
  label?: string;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 id={id} className={railHeading}>
        {children}
      </h2>
      {to ? (
        <Link to={to} className={`flex-shrink-0 ${railLink}`}>
          {label}
        </Link>
      ) : null}
    </div>
  );
}

export interface WantedBook {
  id: string;
  title: string;
  author: string;
  cover: string;
  bookId: string;
  owner: string;
  available: boolean;
  notLending: boolean;
  others: number;
}

// Off your want-to-read list and onto a friend's shelf: each goes to the
// friend's copy, where you can ask for it
export function RailWanted({ books }: { books: WantedBook[] }) {
  if (books.length === 0) return null;
  return (
    <section aria-labelledby="rail-wanted">
      <Heading id="rail-wanted" to="/want-to-read" label="See all">
        On your list, at a friend&apos;s
      </Heading>
      <ul className="space-y-3">
        {books.map((book) => (
          <li key={book.id}>
            <Link to={`/books/${book.bookId}`} className={row}>
              <BookCover
                cover={book.cover}
                title={book.title}
                author={book.author}
                compact
                className="aspect-[2/3] w-9 flex-shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className={title}>{book.title}</span>
                <span className={detail}>
                  {book.notLending
                    ? `${book.owner} isn't lending it yet`
                    : book.available
                      ? `${book.owner} has it`
                      : `${book.owner}'s, out right now`}
                  {book.others > 0 ? ` · ${book.others} more` : ""}
                </span>
              </span>
              {book.available && !book.notLending ? (
                <span className="flex-shrink-0 rounded-md border border-stone-200 dark:border-stone-700 px-2 py-0.5 text-xs text-stone-700 dark:text-stone-200">
                  Ask
                </span>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface LovedBook {
  title: string;
  author: string;
  cover: string;
  friends: { id: string; firstname: string }[];
  href: string | null;
}

// The books friends have hearted lately, most hearts first
export function RailLoved({ books }: { books: LovedBook[] }) {
  if (books.length === 0) return null;
  return (
    <section aria-labelledby="rail-loved">
      <Heading id="rail-loved">
        Loved by friends
      </Heading>
      <ul className="space-y-3">
        {books.map((book) => {
          const inside = (
            <>
              <BookCover
                cover={book.cover}
                title={book.title}
                author={book.author}
                compact
                className="aspect-[2/3] w-9 flex-shrink-0"
              />
              <span className="min-w-0 flex-1">
                <span className={title}>{book.title}</span>
                <span className={`flex items-center gap-1 ${detail}`}>
                  <HeartIcon size={11} filled className="flex-shrink-0 text-rose-400" />
                  <span className="truncate">
                    {names(book.friends.map((friend) => friend.firstname))}
                  </span>
                </span>
              </span>
            </>
          );
          return (
            <li key={book.title}>
              {book.href ? (
                <Link to={book.href} className={row}>
                  {inside}
                </Link>
              ) : (
                <span className="flex items-center gap-3">{inside}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export interface SuggestedPerson {
  id: string;
  firstname: string;
  surname: string;
  profileEmoji: string | null;
  through: string[];
}

// Friends of your friends, each a click from a friend request. Someone
// you've just asked stays in place, marked, rather than vanishing.
export function RailPeople({ people }: { people: SuggestedPerson[] }) {
  const fetcher = useFetcher();
  const [asked, setAsked] = useState<{ person: SuggestedPerson; at: number }[]>([]);
  const shown = [...people.filter((person) => !asked.some((a) => a.person.id === person.id))];
  for (const { person, at } of asked) shown.splice(Math.min(at, shown.length), 0, person);
  if (shown.length === 0) return null;

  const ask = (person: SuggestedPerson) => {
    setAsked((prev) => [...prev, { person, at: shown.indexOf(person) }]);
    fetcher.submit({ friendId: person.id }, { method: "post", action: "/friends/add" });
  };

  return (
    <section aria-labelledby="rail-people">
      <Heading id="rail-people" to="/friends/add" label="Find more">
        People you might know
      </Heading>
      <ul className="space-y-3">
        {shown.map((person) => {
          const sent = asked.some((a) => a.person.id === person.id);
          return (
            <li key={person.id} className="flex items-center gap-3">
              <Avatar
                firstname={person.firstname}
                surname={person.surname}
                icon={person.profileEmoji}
                size="md"
              />
              <span className="min-w-0 flex-1">
                <span className={title}>
                  {person.firstname} {person.surname}
                </span>
                <span className={detail}>Friends with {names(person.through)}</span>
              </span>
              {sent ? (
                <span className="flex-shrink-0 text-xs text-stone-400 dark:text-stone-500">
                  Asked
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => ask(person)}
                  className="flex-shrink-0 rounded-md border border-stone-200 dark:border-stone-700 px-2 py-0.5 text-xs text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors"
                >
                  Add
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
