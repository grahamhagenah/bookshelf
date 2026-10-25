import type { SerializeFrom } from "@remix-run/node";
import { Link, useFetcher } from "@remix-run/react";
import { useState } from "react";

import type { FriendActivity, getNotePrompts } from "~/models/activity.server";

import Avatar from "./avatar";
import BookCover from "./book-cover";
import { BookmarkIcon, HeartIcon } from "./icons";
import PersonLink from "./person-link";

type FeedItem = SerializeFrom<FriendActivity>;
type FeedBook = Extract<FeedItem, { kind: "added" }>["books"][number];
type ElsewhereItem = Extract<FeedItem, { kind: "elsewhere" }>;

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

// "2h", "3d", then the date, as a feed would
function ago(date: string) {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 60) return `${Math.max(1, minutes)}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return formatDate(date);
}

function FeedCover({
  book,
  className,
}: {
  book: Pick<FeedBook, "title" | "author" | "cover">;
  className: string;
}) {
  return (
    <BookCover
      cover={book.cover}
      title={book.title}
      author={book.author}
      className={className}
    />
  );
}

// One book in the sidebar: its cover, with the note (if any) and the
// date beside it, so the words sit with the book they're about
function CoverBeside({
  to,
  book,
  body,
  at,
}: {
  to: string;
  book: Pick<FeedBook, "title" | "author" | "cover">;
  body: string | null;
  at: string;
}) {
  return (
    <div className="mt-2 flex items-start gap-3">
      <Link to={to} title={book.title} className="flex-shrink-0">
        <FeedCover
          book={book}
          className="h-[66px] w-11 hover:opacity-90 transition-opacity"
        />
      </Link>
      <div className="min-w-0">
        {body ? (
          <p className="text-pretty text-sm leading-snug text-stone-600 dark:text-stone-300 line-clamp-3">
            &ldquo;{body}&rdquo;
          </p>
        ) : null}
        <p
          className={`text-xs text-stone-400 dark:text-stone-500 ${body ? "mt-1" : ""}`}
        >
          {formatDate(at)}
        </p>
      </div>
    </div>
  );
}

// The compact entry for the home page sidebar
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
  // A note on a book read somewhere else: the book's own page, not a copy
  if (item.kind === "elsewhere") {
    return (
      <div className="flex items-start gap-3 py-3">
        <Avatar
          firstname={item.friend.firstname}
          surname={item.friend.surname}
          icon={item.friend.profileEmoji}
          size="sm"
        />
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-stone-800 dark:text-stone-200 leading-snug">
            {name} wrote about{" "}
            <Link
              to={item.work.key}
              className="font-semibold underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:underline"
            >
              {item.work.title}
            </Link>
            {item.loved ? (
              <HeartIcon
                size={12}
                filled
                className="ml-1.5 inline text-rose-400 align-[-1px]"
              />
            ) : null}
          </p>
          <CoverBeside
            to={item.work.key}
            book={item.work}
            body={item.body}
            at={item.at}
          />
        </div>
      </div>
    );
  }
  const bookLink = (book: FeedBook) => (
    <Link
      to={`/books/${book.id}`}
      className="font-semibold underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:underline"
    >
      {book.title}
    </Link>
  );

  let text: React.ReactNode;
  let books: FeedBook[];
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
    books = item.books.slice(0, 6);
  } else {
    text = (
      <>
        {name} {item.kind === "loved" ? "loved" : "wrote about"}{" "}
        {bookLink(item.book)}
        {item.kind === "note" && item.loved ? (
          <HeartIcon
            size={12}
            filled
            className="ml-1.5 inline text-rose-400 align-[-1px]"
          />
        ) : null}
      </>
    );
    books = [item.book];
  }
  const more = item.kind === "added" ? item.books.length - books.length : 0;

  return (
    <div className="flex items-start gap-3 py-3">
      <Avatar
        firstname={item.friend.firstname}
        surname={item.friend.surname}
        icon={item.friend.profileEmoji}
        size="sm"
      />
      <div className="min-w-0 flex-1 pt-1">
        <p className="text-stone-800 dark:text-stone-200 leading-snug">
          {text}
        </p>
        {item.kind !== "added" ? (
          <CoverBeside
            to={`/books/${item.book.id}`}
            book={item.book}
            body={item.kind === "note" ? item.body : null}
            at={item.at}
          />
        ) : (
          <>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
              {formatDate(item.at)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {books.map((book) => (
                <Link key={book.id} to={`/books/${book.id}`} title={book.title}>
                  <FeedCover
                    book={book}
                    className="h-[66px] w-11 hover:opacity-90 transition-opacity"
                  />
                </Link>
              ))}
              {more > 0 ? (
                <span className="self-center text-xs text-stone-400 dark:text-stone-500">
                  +{more}
                </span>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---- The Activity page: one post per entry, with things you can do ----

const actionClass =
  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 -mx-2 text-sm text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-900 hover:text-stone-900 dark:hover:text-stone-100 transition-colors";
const stateClass =
  "inline-flex items-center gap-1.5 py-1 text-sm text-stone-400 dark:text-stone-500";

// A cover with the title and author under it, as in the library grid. It
// fills its column, at a book's 2:3 shape.
function BookTile({ book }: { book: FeedBook }) {
  return (
    <li className="min-w-0">
      <Link to={`/books/${book.id}`} title={book.title} className="group block">
        <FeedCover
          book={book}
          className="aspect-[2/3] w-full transition-opacity group-hover:opacity-90"
        />
        <span className="mt-1.5 block truncate text-sm font-medium text-stone-900 dark:text-stone-100">
          {book.title}
        </span>
        <span className="block truncate text-xs text-stone-500 dark:text-stone-400">
          {book.author}
        </span>
        <span className="block truncate text-xs text-stone-400 dark:text-stone-500">
          {book.available
            ? "Available"
            : book.notLending
              ? "Not lending"
              : "Lent out"}
        </span>
      </Link>
    </li>
  );
}

// One book beside its details. Says whose copy it is when it isn't the
// friend's own.
function BookCard({
  book,
  friendId,
  userId,
}: {
  book: FeedBook;
  friendId: string;
  userId: string;
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
      <FeedCover
        book={book}
        className="h-[102px] w-[68px] transition-opacity group-hover:opacity-90"
      />
      <span className="min-w-0">
        <span className="block font-medium leading-snug text-stone-900 dark:text-stone-100">
          {book.title}
        </span>
        <span className="mt-0.5 block text-sm text-stone-500 dark:text-stone-400">
          {book.author}
        </span>
        <span className="mt-2 block text-sm text-stone-500 dark:text-stone-400">
          {whose}
          {book.available
            ? "Available"
            : book.notLending
              ? "Not lending"
              : "Lent out"}
        </span>
      </span>
    </Link>
  );
}

// Hearts, notes and borrowing, done from the feed. Each form posts to
// the feed route; the counts update when the loader comes back.
// The heart is on the book, never the post: under someone's note it says
// so, or it would read as liking what they wrote.
function Actions({
  book,
  userId,
  underNote = false,
}: {
  book: FeedBook;
  userId: string;
  underNote?: boolean;
}) {
  const love = useFetcher({ key: `love-${book.id}` });
  const borrow = useFetcher({ key: `borrow-${book.id}` });
  const { viewer } = book;
  // Asking opens a line for a note first; the ask goes with it
  const [asking, setAsking] = useState(false);

  // What's shown while a change is on its way
  const pendingLove = love.formData?.get("loved");
  const loved = pendingLove ? pendingLove === "true" : viewer.loved;
  const loves = book.loves + (loved ? 1 : 0) - (viewer.loved ? 1 : 0);
  const pendingBorrow = borrow.formData?.get("intent");
  const requested = viewer.requested || pendingBorrow === "request";
  const inLine =
    pendingBorrow === "leaveHold"
      ? false
      : viewer.inLine || pendingBorrow === "placeHold";

  const lovesText = loves === 0 ? null : `${loves}`;
  const isOwner = book.owner.id === userId;
  const isBorrower = book.borrowerId === userId;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-stone-100 dark:border-stone-800 pt-2">
      {viewer.canLove ? (
        <love.Form method="post">
          <input type="hidden" name="intent" value="toggleLove" />
          <input type="hidden" name="bookId" value={book.id} />
          <input type="hidden" name="loved" value={loved ? "false" : "true"} />
          <button
            type="submit"
            aria-pressed={loved}
            className={`${actionClass} ${loved ? "text-rose-600 dark:text-rose-400" : ""}`}
          >
            <HeartIcon
              size={15}
              filled={loved}
              className={loved ? "text-rose-500" : ""}
            />
            {`${loved ? "Loved" : "Love"}${underNote ? " the book" : ""}`}
            {lovesText ? (
              <span className="tabular-nums">{lovesText}</span>
            ) : null}
          </button>
        </love.Form>
      ) : lovesText ? (
        <span
          className={stateClass}
          title="Hearts from people who've read this copy"
        >
          <HeartIcon size={15} filled className="text-rose-400" />
          {lovesText}
        </span>
      ) : null}

      {book.notes > 0 ? (
        <Link to={`/books/${book.id}#notes`} className={actionClass}>
          {book.notes} {book.notes === 1 ? "note" : "notes"}
        </Link>
      ) : null}

      {isOwner ? (
        <span className={stateClass}>Your copy</span>
      ) : isBorrower ? (
        <span className={stateClass}>You have it</span>
      ) : viewer.canRequest && book.notLending ? (
        <span className={stateClass}>Not lending</span>
      ) : viewer.canRequest && book.available ? (
        requested ? (
          <span className={stateClass}>Requested</span>
        ) : asking ? (
          <borrow.Form
            method="post"
            className="flex w-full flex-wrap items-center gap-2"
            onSubmit={() => setAsking(false)}
          >
            <input type="hidden" name="intent" value="request" />
            <input type="hidden" name="bookId" value={book.id} />
            <label htmlFor={`request-note-${book.id}`} className="sr-only">
              A note for {book.owner.firstname}
            </label>
            <input
              id={`request-note-${book.id}`}
              name="message"
              type="text"
              maxLength={300}
              placeholder={`A note for ${book.owner.firstname} (optional)`}
              className="min-w-0 flex-1 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2.5 py-1.5 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500"
            />
            <button
              type="submit"
              className="rounded-md bg-forest-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-forest-700 transition-colors"
            >
              Ask to borrow
            </button>
            <button
              type="button"
              onClick={() => setAsking(false)}
              className={actionClass}
            >
              Cancel
            </button>
          </borrow.Form>
        ) : (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className={actionClass}
          >
            Ask to borrow
          </button>
        )
      ) : viewer.canRequest ? (
        <borrow.Form method="post">
          <input
            type="hidden"
            name="intent"
            value={inLine ? "leaveHold" : "placeHold"}
          />
          <input type="hidden" name="bookId" value={book.id} />
          <button type="submit" className={actionClass}>
            {inLine ? "In line · Leave" : "Get in line"}
          </button>
        </borrow.Form>
      ) : null}

      <Link to={`/books/${book.id}`} className={`${actionClass} ml-auto`}>
        View book
      </Link>
    </div>
  );
}

// A friend's note on a book they read somewhere else. Nothing of theirs
// to borrow, so it offers what can be done: want it, or ask a friend
// who has a copy.
function ElsewhereCard({ item, mine }: { item: ElsewhereItem; mine: boolean }) {
  const want = useFetcher<{ wanted?: boolean }>();
  const { ownCopyId, copies } = item.viewer;
  const wanted =
    item.viewer.wanted ||
    want.formData !== undefined ||
    want.data?.wanted === true;
  const copy = copies[0];
  return (
    <>
      <div className="mt-3">
        <Link
          to={item.work.key}
          className="group -mx-2 flex items-center gap-3 rounded-md px-2 py-1 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors"
        >
          <FeedCover
            book={item.work}
            className="h-[102px] w-[68px] transition-opacity group-hover:opacity-90"
          />
          <span className="min-w-0">
            <span className="block font-medium leading-snug text-stone-900 dark:text-stone-100">
              {item.work.title}
            </span>
            <span className="mt-0.5 block text-sm text-stone-500 dark:text-stone-400">
              {item.work.author}
            </span>
            <span className="mt-2 block text-sm text-stone-500 dark:text-stone-400">
              {ownCopyId
                ? "On your shelf"
                : mine
                  ? "You read it elsewhere"
                  : copy
                    ? `${copy.owner.firstname} has a copy`
                    : `${item.friend.firstname} read it elsewhere`}
            </span>
          </span>
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-stone-100 dark:border-stone-800 pt-2">
        {ownCopyId ? (
          <Link to={`/books/${ownCopyId}`} className={actionClass}>
            Open your copy
          </Link>
        ) : mine ? null : (
          <>
            {wanted ? (
              <span className={stateClass}>
                <BookmarkIcon size={14} />
                On your want-to-read list
              </span>
            ) : (
              <want.Form method="post">
                <input type="hidden" name="intent" value="want" />
                <input type="hidden" name="workKey" value={item.work.key} />
                <button type="submit" className={actionClass}>
                  <BookmarkIcon size={14} />
                  Want to read
                </button>
              </want.Form>
            )}
            {copy ? (
              <Link to={`/books/${copy.bookId}`} className={actionClass}>
                {copy.available
                  ? `Ask ${copy.owner.firstname} to borrow it`
                  : `${copy.owner.firstname}'s copy is out`}
              </Link>
            ) : null}
          </>
        )}
        <Link to={item.work.key} className={`${actionClass} ml-auto`}>
          View book
        </Link>
      </div>
    </>
  );
}

export function FeedPost({
  item,
  friendIds,
  userId,
}: {
  item: FeedItem;
  friendIds: string[];
  userId: string;
}) {
  // Your own notes show in your feed too, as friends will see them
  const name = (
    <strong className="font-semibold text-stone-900 dark:text-stone-100">
      {item.friend.id === userId ? (
        "You"
      ) : (
        <PersonLink
          id={item.friend.id}
          name={`${item.friend.firstname} ${item.friend.surname}`}
          friendIds={friendIds}
        />
      )}
    </strong>
  );
  const did =
    item.kind === "added"
      ? item.books.length === 1
        ? "added a book"
        : `added ${item.books.length} books`
      : item.kind === "elsewhere"
        ? `wrote about ${item.work.title}`
        : item.kind === "loved"
          ? `loved ${item.book.title}`
          : `wrote about ${item.book.title}`;

  const books =
    item.kind === "added"
      ? item.books.slice(0, 8)
      : item.kind === "elsewhere"
        ? []
        : [item.book];
  const more = item.kind === "added" ? item.books.length - books.length : 0;

  return (
    <article className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 px-4 py-3.5">
      <header className="flex items-center gap-3">
        <Avatar
          firstname={item.friend.firstname}
          surname={item.friend.surname}
          icon={item.friend.profileEmoji}
          size="md"
        />
        <p className="min-w-0 leading-snug text-stone-600 dark:text-stone-300">
          {name} {did}
          {(item.kind === "note" || item.kind === "elsewhere") && item.loved ? (
            <HeartIcon
              size={13}
              filled
              className="ml-1.5 inline text-rose-400 align-[-1px]"
            />
          ) : null}
          <span className="text-stone-400 dark:text-stone-500"> · </span>
          <time
            dateTime={item.at}
            title={new Date(item.at).toLocaleString()}
            className="text-sm text-stone-400 dark:text-stone-500"
          >
            {ago(item.at)}
          </time>
        </p>
      </header>

      {(item.kind === "note" || item.kind === "elsewhere") && item.body ? (
        <blockquote className="mt-3 whitespace-pre-line text-pretty leading-relaxed text-stone-800 dark:text-stone-200">
          &ldquo;{item.body}&rdquo;
        </blockquote>
      ) : null}

      {item.kind === "elsewhere" ? (
        <ElsewhereCard item={item} mine={item.friend.id === userId} />
      ) : item.kind === "added" && item.books.length > 1 ? (
        <>
          {/* Even columns: three across on phones, four on wider screens */}
          <ul className="mt-3 grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">
            {books.map((book) => (
              <BookTile key={book.id} book={book} />
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-x-5 border-t border-stone-100 dark:border-stone-800 pt-2">
            <Link to={`/friend/${item.friend.id}`} className={actionClass}>
              {more > 0 ? `+${more} more on ` : "See "}
              {item.friend.firstname}&apos;s shelf
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="mt-3">
            <BookCard
              book={books[0]}
              friendId={item.friend.id}
              userId={userId}
            />
          </div>
          <Actions
            book={books[0]}
            userId={userId}
            underNote={item.kind === "note"}
          />
        </>
      )}
    </article>
  );
}

// ---- "What did you think?" at the top of the feed ----

type PromptBook = SerializeFrom<
  Awaited<ReturnType<typeof getNotePrompts>>
>[number];

// Something to answer, rather than a blank box. Picked by book, so the
// same book keeps the same question.
const QUESTIONS = [
  "Worth the hype? Who should read it next?",
  "Slow start, great ending, couldn't put it down? Say so.",
  "What stayed with you?",
  "Loved it, hated it, or somewhere in between? One line is plenty.",
  "What would you tell the next person who borrows it?",
];
const questionFor = (id: string) =>
  QUESTIONS[
    [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) %
      QUESTIONS.length
  ];

// A book you borrowed and haven't written about, with a place to do it.
// Saving or skipping moves on to the next one.
export function NotePrompt({ books }: { books: PromptBook[] }) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const fetcher = useFetcher({ key: "note-prompt" });
  const [body, setBody] = useState("");
  const saving = fetcher.state !== "idle";

  const left = books.filter((book) => !skipped.includes(book.id));
  const book = left[0];
  if (!book) return null;
  const others = left.slice(1);

  return (
    <section
      aria-label="Leave a note"
      className="rounded-xl border border-stone-200 dark:border-stone-800 px-4 py-3"
    >
      {/* Like a post: a header with the book, then the body */}
      <div className="flex items-center gap-3">
        <Link to={`/books/${book.id}`} className="flex-shrink-0">
          <FeedCover book={book} className="h-12 w-8" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="leading-snug text-stone-800 dark:text-stone-200">
            What did you think of{" "}
            <Link
              to={`/books/${book.id}`}
              className="font-medium text-stone-900 dark:text-stone-100 underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:underline"
            >
              {book.title}
            </Link>
            ?
          </p>
          <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
            {book.returned ? "You borrowed it" : "You're borrowing it"} from{" "}
            {book.owner.firstname}. Your note stays with the book for the next
            reader.
          </p>
        </div>
      </div>
      <div>
        <fetcher.Form
          method="post"
          className="mt-3"
          onSubmit={(event) => {
            if (!body.trim()) {
              event.preventDefault();
              return;
            }
            // Clear and move on; the saved note appears in the feed below
            setTimeout(() => {
              setBody("");
              setSkipped((list) => [...list, book.id]);
            }, 0);
          }}
        >
          <input type="hidden" name="intent" value="note" />
          <input type="hidden" name="bookId" value={book.id} />
          <textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={1}
            maxLength={500}
            required
            placeholder={questionFor(book.id)}
            aria-label="Your note"
            className="w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 py-2 text-sm leading-relaxed text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10"
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="submit"
              // Always full strength; an empty note is stopped by the box
              // being required, not by a faded button
              disabled={saving}
              className="rounded-md bg-forest-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-forest-700 transition-colors disabled:cursor-wait"
            >
              {saving ? "Saving…" : "Leave a note"}
            </button>
            <button
              type="button"
              onClick={() => {
                setBody("");
                setSkipped((list) => [...list, book.id]);
              }}
              className="px-1 py-1.5 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
            >
              Not now
            </button>
            {others.length > 0 ? (
              <span className="ml-auto text-sm text-stone-400 dark:text-stone-500">
                +{others.length} more
              </span>
            ) : null}
          </div>
        </fetcher.Form>
      </div>
    </section>
  );
}
