import type { SerializeFrom } from "@remix-run/node";
import { Link } from "@remix-run/react";

import type { FriendActivity } from "~/models/activity.server";
import { coverSrc } from "~/utils";

import Avatar from "./avatar";
import CoverPlaceholder from "./cover-placeholder";
import { HeartIcon } from "./icons";
import PersonLink from "./person-link";

type FeedItem = SerializeFrom<FriendActivity>;
type FeedBook = Extract<FeedItem, { kind: "added" }>["books"][number];

// The home page shows a compact feed in a sidebar; the Activity page has
// room for bigger covers, titles and authors, and the full note
type Layout = "compact" | "full";

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function FeedCover({ book, className }: { book: FeedBook; className: string }) {
  return (
    <span
      className={`relative block flex-shrink-0 overflow-hidden rounded-xs bg-stone-100 dark:bg-stone-800 ring-1 ring-stone-900/5 dark:ring-white/10 ${className}`}
    >
      <CoverPlaceholder title={book.title} author={book.author} className="absolute inset-0" />
      {book.cover ? (
        <img
          src={coverSrc(book.cover)}
          alt=""
          loading="lazy"
          className="relative h-full w-full object-cover"
        />
      ) : null}
    </span>
  );
}

// A cover with the title and author under it, as in the library grid
function BookTile({ book }: { book: FeedBook }) {
  return (
    <li className="w-24">
      <Link to={`/books/${book.id}`} title={book.title} className="group block">
        <FeedCover book={book} className="h-36 w-24 transition-opacity group-hover:opacity-90" />
        <span className="mt-1.5 block truncate text-sm font-medium text-stone-900 dark:text-stone-100">
          {book.title}
        </span>
        <span className="block truncate text-xs text-stone-500 dark:text-stone-400">
          {book.author}
        </span>
        <span className="block truncate text-xs text-stone-400 dark:text-stone-500">
          {book.available ? "Available" : "Lent out"}
        </span>
      </Link>
    </li>
  );
}

// One book beside its details: for a single addition, a heart or a note.
// Says whose copy it is when it isn't the friend's own.
function BookCard({
  book,
  friendId,
  userId,
}: {
  book: FeedBook;
  friendId: string;
  userId?: string;
}) {
  const whose =
    book.owner.id === friendId
      ? null
      : book.owner.id === userId
        ? "Your copy · "
        : `${book.owner.firstname}'s copy · `;
  return (
    <Link
      to={`/books/${book.id}`}
      className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-1 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
    >
      <FeedCover book={book} className="h-[102px] w-[68px] transition-opacity group-hover:opacity-90" />
      <span className="min-w-0">
        <span className="block font-medium leading-snug text-stone-900 dark:text-stone-100">
          {book.title}
        </span>
        <span className="mt-0.5 block text-sm text-stone-500 dark:text-stone-400">
          {book.author}
        </span>
        <span className="mt-2 block text-sm text-stone-500 dark:text-stone-400">
          {whose}
          {book.available ? "Available" : "Lent out"}
        </span>
      </span>
    </Link>
  );
}

// One entry of what a friend has been up to
export default function FriendActivityItem({
  item,
  friendIds,
  userId,
  layout = "compact",
}: {
  item: FeedItem;
  friendIds: string[];
  // Who's looking, so their own copies read as "Your copy"
  userId?: string;
  layout?: Layout;
}) {
  const full = layout === "full";
  const name = (
    <strong className="font-semibold">
      <PersonLink
        id={item.friend.id}
        name={`${item.friend.firstname} ${item.friend.surname}`}
        friendIds={friendIds}
      />
    </strong>
  );
  const bookLink = (book: FeedBook) => (
    <Link
      to={`/books/${book.id}`}
      className="font-semibold underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:underline"
    >
      {book.title}
    </Link>
  );
  const heart = (
    <HeartIcon size={full ? 14 : 12} filled className="ml-1.5 inline text-rose-400 align-[-1px]" />
  );

  // The line of text, and which books to show under it. On the full
  // layout the book is named by its card, so the line stays short.
  let text: React.ReactNode;
  let books: FeedBook[];
  if (item.kind === "added") {
    text =
      item.books.length === 1 ? (
        <>
          {name} added {full ? "a book" : bookLink(item.books[0])}
        </>
      ) : (
        <>
          {name} added {item.books.length} books
        </>
      );
    books = item.books.slice(0, full ? 8 : 6);
  } else {
    text = (
      <>
        {name} {item.kind === "loved" ? "loved" : "wrote about"}{" "}
        {full ? item.book.title : bookLink(item.book)}
        {item.kind === "note" && item.loved ? heart : null}
      </>
    );
    books = [item.book];
  }
  const more = item.kind === "added" ? item.books.length - books.length : 0;

  if (!full) {
    return (
      <div className="flex items-start gap-3 py-3">
        <Avatar
          firstname={item.friend.firstname}
          surname={item.friend.surname}
          icon={item.friend.profileEmoji}
          size="sm"
        />
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-stone-800 dark:text-stone-200 leading-snug">{text}</p>
          {item.kind === "note" && item.body ? (
            <p className="mt-1 text-pretty text-sm text-stone-600 dark:text-stone-300 line-clamp-2">
              &ldquo;{item.body}&rdquo;
            </p>
          ) : null}
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{formatDate(item.at)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {books.map((book) => (
              <Link key={book.id} to={`/books/${book.id}`} title={book.title}>
                <FeedCover book={book} className="h-[66px] w-11 hover:opacity-90 transition-opacity" />
              </Link>
            ))}
            {more > 0 ? (
              <span className="self-center text-xs text-stone-400 dark:text-stone-500">+{more}</span>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <article className="flex items-start gap-4 py-4">
      <Avatar
        firstname={item.friend.firstname}
        surname={item.friend.surname}
        icon={item.friend.profileEmoji}
        size="md"
      />
      <div className="min-w-0 flex-1">
        {/* The day heading above says when */}
        <p className="leading-snug text-stone-800 dark:text-stone-200">{text}</p>

        {item.kind === "note" && item.body ? (
          <blockquote className="mt-1.5 max-w-prose text-pretty text-lg leading-relaxed text-stone-700 dark:text-stone-300">
            &ldquo;{item.body}&rdquo;
          </blockquote>
        ) : null}

        {item.kind === "added" && item.books.length > 1 ? (
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-3">
            {books.map((book) => (
              <BookTile key={book.id} book={book} />
            ))}
            {more > 0 ? (
              <li className="flex w-24 items-center justify-center">
                <Link
                  to={`/friend/${item.friend.id}`}
                  className="text-sm text-stone-500 dark:text-stone-400 underline-offset-2 hover:underline"
                >
                  +{more} more
                </Link>
              </li>
            ) : null}
          </ul>
        ) : (
          <div className="mt-2">
            <BookCard book={books[0]} friendId={item.friend.id} userId={userId} />
          </div>
        )}
      </div>
    </article>
  );
}
