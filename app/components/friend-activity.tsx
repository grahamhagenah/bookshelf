import type { SerializeFrom } from "@remix-run/node";
import { Link } from "@remix-run/react";

import type { FriendActivity } from "~/models/activity.server";
import { coverSrc } from "~/utils";

import Avatar from "./avatar";
import { HeartIcon } from "./icons";
import PersonLink from "./person-link";

type FeedItem = SerializeFrom<FriendActivity>;
interface FeedBook { id: string; title: string; cover: string }

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function FeedCover({ book }: { book: FeedBook }) {
  return (
    <Link
      to={`/books/${book.id}`}
      title={book.title}
      className="block w-9 h-[54px] flex-shrink-0 overflow-hidden rounded-xs bg-stone-100 dark:bg-stone-800 ring-1 ring-stone-900/5 dark:ring-white/10 hover:opacity-90 transition-opacity"
    >
      <img
        src={coverSrc(book.cover)}
        alt={book.title}
        loading="lazy"
        className="h-full w-full object-cover"
      />
    </Link>
  );
}

// One line of what a friend has been up to
export default function FriendActivityItem({
  item,
  friendIds,
}: {
  item: FeedItem;
  friendIds: string[];
}) {
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

  let text: React.ReactNode;
  let covers: FeedBook[];
  if (item.kind === "added") {
    text =
      item.books.length === 1 ? (
        <>
          {name} added {bookLink(item.books[0])}
        </>
      ) : (
        <>
          {name} added {item.books.length} books
        </>
      );
    covers = item.books.slice(0, 6);
  } else {
    text = (
      <>
        {name} {item.kind === "loved" ? "loved" : "wrote about"} {bookLink(item.book)}
        {item.kind === "note" && item.loved ? (
          <HeartIcon size={12} filled className="ml-1.5 inline text-rose-400 align-[-1px]" />
        ) : null}
      </>
    );
    covers = [item.book];
  }

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
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-300 line-clamp-2">
            &ldquo;{item.body}&rdquo;
          </p>
        ) : null}
        <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
          {formatDate(item.at)}
        </p>
        {item.kind === "added" && covers.length > 1 ? (
          <div className="mt-2 flex gap-2">
            {covers.map((book) => (
              <FeedCover key={book.id} book={book} />
            ))}
            {item.books.length > covers.length ? (
              <span className="self-center text-xs text-stone-400 dark:text-stone-500">
                +{item.books.length - covers.length}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      {item.kind !== "added" || covers.length === 1 ? <FeedCover book={covers[0]} /> : null}
    </div>
  );
}
