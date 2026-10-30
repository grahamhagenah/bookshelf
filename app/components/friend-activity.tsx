import { useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";

import { groupPath } from "~/group-links";
import type { FriendActivity, getNotePrompts, Lender } from "~/models/activity.server";
import { useOptionalUser, workPath } from "~/utils";

import Avatar from "./avatar";
import BookCover from "./book-cover";
import { meetingPast, meetingWhen } from "./group-board";
import { BookmarkIcon, HeartIcon, PencilIcon } from "./icons";
import PersonLink from "./person-link";
import { primaryButton, quietButton } from "./ui";

type FeedItem = FriendActivity;
type FeedBook = Extract<FeedItem, { kind: "added" }>["books"][number];
type ElsewhereItem = Extract<FeedItem, { kind: "elsewhere" }>;
type PickItem = Extract<FeedItem, { kind: "pick" }>;

const formatDate = (date: string | Date) =>
  new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

// "2h", "3d", then the date, as a feed would
function ago(date: string | Date) {
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
  at: string | Date;
}) {
  return (
    <div className="mt-2 flex items-start gap-3">
      <Link to={to} title={book.title} className="flex-shrink-0">
        <FeedCover
          book={book}
          className="h-15 w-10 hover:opacity-90 transition-opacity"
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

// "you", "you and Maya", "you, Maya and Sam": the people in a group,
// the viewer first
function namesOf(people: { id: string; firstname: string }[], userId: string | null) {
  const names = [
    ...people.filter((person) => person.id === userId).map(() => "you"),
    ...people.filter((person) => person.id !== userId).map((person) => person.firstname),
  ];
  return names.length <= 1
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// Where a group's pick goes: the book's own page, or a search for it
const pickPage = (work: PickItem["work"]) =>
  workPath(work.key) ?? `/search?${new URLSearchParams({ q: `${work.title} ${work.author}`.trim() })}`;

// A title's last word and what follows it (a heart) stay on one line, so
// the heart never wraps onto a line by itself
function KeepWithLast({
  text,
  after,
}: {
  text: string;
  after: React.ReactNode;
}) {
  if (!after) return <>{text}</>;
  const at = text.lastIndexOf(" ");
  return (
    <>
      {text.slice(0, at + 1)}
      <span className="whitespace-nowrap">
        {text.slice(at + 1)}
        {after}
      </span>
    </>
  );
}

const SmallHeart = ({ size }: { size: number }) => (
  <HeartIcon
    size={size}
    filled
    className="ml-1.5 inline text-rose-400 align-[-1px]"
  />
);

// The compact entry for the home page sidebar
export default function FriendActivityItem({
  item,
  friendIds,
}: {
  item: FeedItem;
  friendIds: string[];
}) {
  // Who's looking, to call them "you" among a group's people
  const viewer = useOptionalUser();
  const name = (
    <strong className="font-semibold">
      <PersonLink
        id={item.friend.id}
        name={`${item.friend.firstname} ${item.friend.surname}`}
        friendIds={friendIds}
      />
    </strong>
  );
  // A group picked a book: the group's faces, what it's reading, and who's in
  if (item.kind === "pick") {
    const group = (
      <Link
        to={groupPath(item.group)}
        className="font-semibold underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:underline"
      >
        {item.group.name}
      </Link>
    );
    return (
      <div className="flex items-start gap-3 py-3">
        <Avatar
          firstname={item.friend.firstname}
          surname={item.friend.surname}
          icon={item.friend.profileEmoji}
          size="rail"
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-stone-800 dark:text-stone-200 leading-snug">
            {item.friend.id === viewer?.id ? <strong className="font-semibold">You</strong> : name} picked{" "}
            <Link
              to={pickPage(item.work)}
              className="font-semibold underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:underline"
            >
              {item.work.title}
            </Link>{" "}
            for {group}
          </p>
          <div className="mt-2 flex items-start gap-3">
            <Link to={pickPage(item.work)} title={item.work.title} className="flex-shrink-0">
              <FeedCover book={item.work} className="h-15 w-10 hover:opacity-90 transition-opacity" />
            </Link>
            <div className="min-w-0 text-sm leading-snug text-stone-600 dark:text-stone-300">
              <p>With {namesOf(item.people, viewer?.id ?? null)}</p>
              <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                {item.meeting?.at
                  ? `${meetingPast(item.meeting.at) ? "Met" : "Meets"} ${meetingWhen(item.meeting.at)}`
                  : formatDate(item.at)}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
  // A note on a book read somewhere else: the book's own page, not a copy
  if (item.kind === "elsewhere") {
    return (
      <div className="flex items-start gap-3 py-3">
        <Avatar
          firstname={item.friend.firstname}
          surname={item.friend.surname}
          icon={item.friend.profileEmoji}
          size="rail"
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-stone-800 dark:text-stone-200 leading-snug">
            {name} wrote about{" "}
            <Link
              to={item.work.key}
              className="font-semibold underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:underline"
            >
              <KeepWithLast
                text={item.work.title}
                after={item.loved ? <SmallHeart size={12} /> : null}
              />
            </Link>
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
  const bookLink = (book: FeedBook, after: React.ReactNode = null) => (
    <Link
      to={`/books/${book.id}`}
      className="font-semibold underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:underline"
    >
      <KeepWithLast text={book.title} after={after} />
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
    // One row of covers in a side column, then how many more
    books = item.books.slice(0, 5);
  } else {
    text = (
      <>
        {name} {item.kind === "loved" ? "loved" : "wrote about"}{" "}
        {bookLink(
          item.book,
          item.kind === "note" && item.loved ? <SmallHeart size={12} /> : null,
        )}
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
        size="rail"
      />
      <div className="min-w-0 flex-1 pt-0.5">
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
                    className="h-15 w-10 hover:opacity-90 transition-opacity"
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
// The thing a post asks of you (borrow it, get in line, save it, give it
// back), as a button of its own, as the lists' rows have it
const nextClass = `${quietButton("sm")} inline-flex items-center gap-1.5 font-medium`;
const stateClass =
  "inline-flex items-center gap-1.5 py-1 text-sm text-stone-400 dark:text-stone-500";

// A cover with the title and author under it, as in the library grid. It
// fills its column, at a book's 2:3 shape. Whether it's in goes unsaid
// here: that's for the book page, and the title gets the room instead.
function BookTile({ book, className = "" }: { book: FeedBook; className?: string }) {
  return (
    <li className={`min-w-0 ${className}`}>
      <Link to={`/books/${book.id}`} title={book.title} className="group block">
        <FeedCover
          book={book}
          className="aspect-[2/3] w-full transition-opacity group-hover:opacity-90"
        />
        <span className="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-stone-900 dark:text-stone-100">
          {book.title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-stone-500 dark:text-stone-400">
          {book.author}
        </span>
      </Link>
    </li>
  );
}

// One book's row on the same grid as an "added 3 books" post's tiles,
// three across on phones and four from there: the cover takes a column,
// at the very size of a tile's, and what's beside it takes the rest
const bookRow = "grid grid-cols-3 gap-x-4 sm:grid-cols-4";
const coverColumn = "block min-w-0";
const besideCover = "col-span-2 min-w-0 sm:col-span-3";
const bigCover = "aspect-[2/3] w-full transition-opacity group-hover:opacity-90";


// What someone wrote about a book, beside its cover, so the words sit
// with the book they're about, as on the home page
function NoteBeside({ body }: { body: string }) {
  return (
    <span className="mb-2 block whitespace-pre-line text-pretty leading-relaxed text-stone-800 dark:text-stone-200">
      &ldquo;{body}&rdquo;
    </span>
  );
}

// One book's cover, named in the post's headline, and beside it the
// post's note and where the copy is. Says whose copy it is when it isn't
// the friend's own, and who lent it to them when they borrowed it. A link
// to the book covers the card, with the lender's name over it as its own
// link.
function BookCard({
  book,
  friendId,
  userId,
  from = null,
  note = null,
}: {
  book: FeedBook;
  friendId: string;
  userId: string;
  from?: Lender | null;
  // The post's words, beside the cover
  note?: string | null;
}) {
  const [asking, setAsking] = useState(false);
  // Your own copy is said in the row under the card, so not here too
  const whose = from?.relation === "you" || book.owner.id === userId ? null : from ? (
    <>
      Borrowed from{" "}
      <LenderName from={from} asking={asking} onAsk={() => setAsking((was) => !was)} />
      {" · "}
    </>
  ) : book.owner.id === friendId ? null : (
    `${book.owner.firstname}'s copy · `
  );
  return (
    <div className="group relative -mx-2 rounded-md px-2 py-1 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors">
      <div className={`${bookRow} items-start`}>
        <div className={coverColumn}>
          <FeedCover book={book} className={bigCover} />
          {/* Named in the post's headline; this is the way to its page,
              across the whole card */}
          <Link
            to={`/books/${book.id}`}
            className="after:absolute after:inset-0 after:content-['']"
          >
            <span className="sr-only">
              {book.title} by {book.author}
            </span>
          </Link>
        </div>
        <span className={`${besideCover} pt-0.5`}>
          {note ? <NoteBeside body={note} /> : null}
          <span className="block text-sm text-stone-500 dark:text-stone-400">
            {whose}
            {book.available
              ? "Available"
              : book.notLending
                ? "Not lending"
                : "Lent out"}
          </span>
        </span>
      </div>
      {asking && from ? <FriendPrompt from={from} /> : null}
    </div>
  );
}

// Borrowing, done from the feed. Each form posts to the feed route; what
// it says updates when the loader comes back. No heart or note count:
// beside a post they read as reactions to the post, not the book.
function Actions({
  book,
  userId,
  onEdit,
  mine = false,
  poster = null,
  from = null,
}: {
  book: FeedBook;
  userId: string;
  // Who the poster borrowed it from, when they did
  from?: Lender | null;
  // Under your own note: rewrite it
  onEdit?: () => void;
  // Your own post about a friend's copy: you've read it
  mine?: boolean;
  // Whose post it is, for the way to their shelf; none on your own
  poster?: { id: string; firstname: string } | null;
}) {
  const borrow = useFetcher({ key: `borrow-${book.id}` });
  const giveBack = useFetcher<{ returned?: boolean }>({ key: `return-${book.id}` });
  const want = useFetcher<{ wanted?: boolean }>({ key: `want-${book.id}` });
  const returned = giveBack.formData !== undefined || giveBack.data?.returned === true;
  const { viewer } = book;
  // Asking opens a line for a note first; the ask goes with it
  const [asking, setAsking] = useState(false);

  // What's shown while a change is on its way
  const pendingBorrow = borrow.formData?.get("intent");
  const requested = viewer.requested || pendingBorrow === "request";
  const inLine =
    pendingBorrow === "leaveHold"
      ? false
      : viewer.inLine || pendingBorrow === "placeHold";
  const wanted = viewer.wanted || want.formData !== undefined || want.data?.wanted === true;

  const isOwner = book.owner.id === userId;
  const isBorrower = book.borrowerId === userId;

  // The one thing this post offers you, by where you stand with the book.
  // Your own copy offers nothing to do, so the row says it's yours, and
  // that they had it from you when they did
  const next = isOwner ? (
    <span className={stateClass}>
      {from?.relation === "you" && poster
        ? `${poster.firstname} borrowed it from you`
        : "Your copy"}
    </span>
  ) : returned ? (
    <span className={stateClass}>Returned to {book.owner.firstname}</span>
  ) : isBorrower ? (
    // Read it, said so: the next thing is giving it back
    <giveBack.Form method="post" action={`/books/${book.id}`}>
      <input type="hidden" name="intent" value="return" />
      <input type="hidden" name="stay" value="true" />
      <button type="submit" className={nextClass}>
        Return to {book.owner.firstname}
      </button>
    </giveBack.Form>
  ) : mine || viewer.readIt ? (
    // Read it already: no asking for it again
    <span className={stateClass}>You read it</span>
  ) : viewer.onShelf ? (
    <span className={stateClass}>On your shelf</span>
  ) : viewer.canRequest && book.available ? (
    requested ? (
      <span className={stateClass}>Requested</span>
    ) : (
      <button
        type="button"
        onClick={() => setAsking(!asking)}
        aria-expanded={asking}
        className={`${nextClass} ${asking ? "border-stone-400 dark:border-stone-500" : ""}`}
      >
        Ask to borrow
      </button>
    )
  ) : viewer.canRequest && !book.notLending ? (
    // Lent out: wait your turn
    <borrow.Form method="post" action="/feed">
      <input type="hidden" name="intent" value={inLine ? "leaveHold" : "placeHold"} />
      <input type="hidden" name="bookId" value={book.id} />
      <button type="submit" className={inLine ? actionClass : nextClass}>
        {inLine ? "In line · Leave" : "Get in line"}
      </button>
    </borrow.Form>
  ) : wanted ? (
    <span className={stateClass}>
      <BookmarkIcon size={14} filled />
      On your list
    </span>
  ) : (
    // Not being lent, or not a friend's to ask for: keep it on your list,
    // and hear when there's a copy you can borrow
    <want.Form method="post" action="/feed">
      <input type="hidden" name="intent" value="wantBook" />
      <input type="hidden" name="bookId" value={book.id} />
      <button type="submit" className={nextClass}>
        <BookmarkIcon size={14} />
        Want to read
      </button>
    </want.Form>
  );
  // The links across from it show on phones only when there's nothing
  // else in the row; there the cover, title and name already lead to them
  const links = next || onEdit ? "hidden sm:flex" : "flex";

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-stone-100 dark:border-stone-800 pt-2">
        {onEdit ? (
          <button type="button" onClick={onEdit} className={actionClass}>
            <PencilIcon size={14} />
            Edit note
          </button>
        ) : null}
        {next}

        <span className={`ml-auto items-center gap-x-5 ${links}`}>
          {poster ? (
            <Link to={`/friend/${poster.id}`} className={actionClass}>
              {poster.firstname}&apos;s shelf
            </Link>
          ) : null}
          <Link to={`/books/${book.id}`} className={actionClass}>
            View book
          </Link>
        </span>
      </div>
      {/* The ask, on a line of its own under the row, so the row keeps its
          shape while you write */}
      {asking && viewer.canRequest && book.available && !requested ? (
        <borrow.Form
          method="post"
          action="/feed"
          className="mt-2 flex flex-wrap items-center gap-2"
          onSubmit={() => setAsking(false)}
        >
          <input type="hidden" name="intent" value="request" />
          <input type="hidden" name="bookId" value={book.id} />
          <label htmlFor={`request-note-${book.id}`} className="sr-only">
            A message for {book.owner.firstname}
          </label>
          <input
            id={`request-note-${book.id}`}
            name="message"
            type="text"
            maxLength={300}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            placeholder={`A message for ${book.owner.firstname} (optional)`}
            className="min-w-0 flex-1 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2.5 py-1.5 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500"
          />
          <button type="submit" className={primaryButton("md")}>
            Send request
          </button>
          <button
            type="button"
            onClick={() => setAsking(false)}
            className={actionClass}
          >
            Cancel
          </button>
        </borrow.Form>
      ) : null}
    </>
  );
}

// A friend's note on a book they read somewhere else. Nothing of theirs
// to borrow, so it offers what can be done: want it, or ask a friend
// who has a copy.
function ElsewhereCard({
  item,
  mine,
  onEdit,
  note = null,
}: {
  item: ElsewhereItem;
  mine: boolean;
  // The post's words, beside the cover
  note?: string | null;
  // Your own note: rewrite it
  onEdit?: () => void;
}) {
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
          className={`group -mx-2 ${bookRow} items-start rounded-md px-2 py-1 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors`}
        >
          <span className={coverColumn}>
            <FeedCover book={item.work} className={bigCover} />
            <span className="sr-only">
              {item.work.title} by {item.work.author}
            </span>
          </span>
          <span className={`${besideCover} pt-0.5`}>
            {note ? <NoteBeside body={note} /> : null}
            <span className="block text-sm text-stone-500 dark:text-stone-400">
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
        {onEdit ? (
          <button type="button" onClick={onEdit} className={actionClass}>
            <PencilIcon size={14} />
            Edit note
          </button>
        ) : null}
        {ownCopyId ? (
          <Link to={`/books/${ownCopyId}`} className={actionClass}>
            Open your copy
          </Link>
        ) : mine ? null : (
          <>
            {wanted ? (
              <span className={stateClass}>
                <BookmarkIcon size={14} />
                On your Want to read list
              </span>
            ) : (
              <want.Form method="post" action="/feed">
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
        <span className="ml-auto hidden sm:block">
          <Link to={item.work.key} className={actionClass}>
            View book
          </Link>
        </span>
      </div>
    </>
  );
}

// A group the viewer is in picked a book to read together: the book, when
// they meet, and everyone in it, with the one thing to do about a copy
function PickCard({ item, userId }: { item: PickItem; userId: string }) {
  const want = useFetcher<{ wanted?: boolean }>();
  const { ownCopyId, copies } = item.viewer;
  const wanted =
    item.viewer.wanted || want.formData !== undefined || want.data?.wanted === true;
  const copy = copies[0];
  const page = pickPage(item.work);
  return (
    <>
      <div className="mt-3">
        <Link
          to={page}
          className={`group -mx-2 ${bookRow} items-center rounded-md px-2 py-1 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors`}
        >
          <FeedCover book={item.work} className={bigCover} />
          <span className={besideCover}>
            <span className="block text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
              {item.group.name} is reading
            </span>
            <span className="mt-0.5 block font-medium leading-snug text-stone-900 dark:text-stone-100">
              {item.work.title}
            </span>
            <span className="mt-0.5 block text-sm text-stone-500 dark:text-stone-400">
              {item.work.author}
            </span>
            {item.meeting ? (
              <span className="mt-2 block text-sm text-stone-600 dark:text-stone-300">
                {meetingPast(item.meeting.at) ? "Met" : "Meets"}{" "}
                {[item.meeting.at ? meetingWhen(item.meeting.at) : null, item.meeting.place]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            ) : null}
          </span>
        </Link>
      </div>
      <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
        With {namesOf(item.people, userId)}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-stone-100 dark:border-stone-800 pt-2">
        {ownCopyId ? (
          <Link to={`/books/${ownCopyId}`} className={actionClass}>
            You have a copy
          </Link>
        ) : copy?.requested ? (
          <Link to={`/books/${copy.bookId}`} className={stateClass}>
            Requested from {copy.owner.firstname}
          </Link>
        ) : copy ? (
          <Link to={`/books/${copy.bookId}`} className={nextClass}>
            {copy.available
              ? `Ask ${copy.owner.firstname} to borrow it`
              : `${copy.owner.firstname}'s copy is out`}
          </Link>
        ) : null}
        {!ownCopyId && item.work.key ? (
          wanted ? (
            <span className={stateClass}>
              <BookmarkIcon size={14} />
              On your Want to read list
            </span>
          ) : (
            <want.Form method="post" action="/feed">
              <input type="hidden" name="intent" value="want" />
              <input type="hidden" name="workKey" value={item.work.key} />
              <button type="submit" className={actionClass}>
                <BookmarkIcon size={14} />
                Want to read
              </button>
            </want.Form>
          )
        ) : null}
        <span className="ml-auto">
          <Link to={groupPath(item.group)} className={actionClass}>
            Open the group
          </Link>
        </span>
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
  // A single book is named here, with who wrote it, so its card can be
  // just the cover and what was said about it
  const titled = (book: { title: string; author: string | null }) =>
    book.author ? `${book.title} by ${book.author}` : book.title;
  const did =
    item.kind === "added"
      ? item.books.length === 1
        ? "added a book"
        : `added ${item.books.length} books`
      : item.kind === "elsewhere"
        ? `wrote about ${titled(item.work)}`
        : item.kind === "pick"
          ? `picked ${item.work.title} for ${item.group.name}`
          : item.kind === "loved"
          ? `loved ${titled(item.book)}`
          : `wrote about ${titled(item.book)}`;

  const books =
    item.kind === "added"
      ? item.books.slice(0, 4)
      : item.kind === "elsewhere" || item.kind === "pick"
        ? []
        : [item.book];
  const more = item.kind === "added" ? item.books.length - books.length : 0;

  // Your own words, editable where you see them
  const note =
    (item.kind === "note" || item.kind === "elsewhere") && item.body ? item : null;
  const editable = note !== null && item.friend.id === userId;
  const [editing, setEditing] = useState(false);

  return (
    <article className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 px-4 py-3.5">
      <header className="flex items-center gap-3">
        <Avatar
          firstname={item.friend.firstname}
          surname={item.friend.surname}
          icon={item.friend.profileEmoji}
          size="md"
        />
        <div className="min-w-0 flex-1">
          <p className="leading-snug text-stone-600 dark:text-stone-300">
            {name}{" "}
            <KeepWithLast
              text={did}
              after={
                (item.kind === "note" || item.kind === "elsewhere") &&
                item.loved ? (
                  <SmallHeart size={13} />
                ) : null
              }
            />
            <span className="text-stone-400 dark:text-stone-500"> · </span>
            <time
              dateTime={new Date(item.at).toISOString()}
              title={new Date(item.at).toLocaleString()}
              className="text-sm text-stone-400 dark:text-stone-500"
            >
              {ago(item.at)}
            </time>
          </p>
        </div>
      </header>

      {/* Being rewritten, the note gets the card's width; otherwise it
          sits beside its book */}
      {note && editing ? (
        <NoteEdit item={note} onDone={() => setEditing(false)} />
      ) : null}

      {item.kind === "pick" ? (
        <PickCard item={item} userId={userId} />
      ) : item.kind === "elsewhere" ? (
        <ElsewhereCard
          item={item}
          mine={item.friend.id === userId}
          onEdit={editable && !editing ? () => setEditing(true) : undefined}
          note={note && !editing ? note.body : null}
        />
      ) : item.kind === "added" && item.books.length > 1 ? (
        <>
          {/* One row of covers big enough for their titles: three across
              on phones, four from there; the rest are on their shelf */}
          <ul className="mt-3 grid grid-cols-3 gap-x-4 gap-y-4 sm:grid-cols-4">
            {books.map((book, index) => (
              <BookTile
                key={book.id}
                book={book}
                className={index === 3 ? "hidden sm:block" : ""}
              />
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
              from={item.kind === "loved" || item.kind === "note" ? item.from : null}
              note={note && !editing ? note.body : null}
            />
          </div>
          <Actions
            book={books[0]}
            userId={userId}
            onEdit={editable && !editing ? () => setEditing(true) : undefined}
            mine={item.friend.id === userId}
            poster={item.friend.id === userId ? null : item.friend}
            from={item.kind === "loved" || item.kind === "note" ? item.from : null}
          />
        </>
      )}
    </article>
  );
}

// Your note, rewritten in place: on the copy it's about, or on the book
// itself when you read it elsewhere. Saving an empty box takes the words
// away and leaves the heart
function NoteEdit({
  item,
  onDone,
}: {
  item: Exclude<FeedItem, { kind: "added" | "pick" }>;
  onDone: () => void;
}) {
  const fetcher = useFetcher<{ ok?: boolean }>();
  const [body, setBody] = useState(item.body ?? "");
  const saving = fetcher.state !== "idle";
  const action = "work" in item ? workPath(item.work.key) : null;
  // Opens ready to go on writing: focused, the cursor after the last word
  const box = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  // Back to the quote once it's saved; the feed has the new words by then
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) onDone();
  }, [fetcher.state, fetcher.data, onDone]);

  return (
    <fetcher.Form method="post" action={action ?? "/feed"} className="mt-3">
      {"work" in item ? (
        <input type="hidden" name="intent" value="saveNote" />
      ) : (
        <>
          <input type="hidden" name="intent" value="note" />
          <input type="hidden" name="bookId" value={item.book.id} />
        </>
      )}
      {/* An edit, not news: it keeps its place in the feed, and the owner
          isn't told again */}
      <input type="hidden" name="edit" value="true" />
      <textarea
        ref={box}
        name="body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={3}
        maxLength={500}
        aria-label="Your note"
        className="w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 px-3 py-2 leading-relaxed text-stone-900 dark:text-stone-100 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className={`${primaryButton("md")} disabled:cursor-wait`}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="px-1 py-1.5 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
        >
          Cancel
        </button>
      </div>
    </fetcher.Form>
  );
}

// Whose copy a friend borrowed. A friend's name opens their shelf. Anyone
// else's shelf is closed to you, so their name offers a friend request
// instead, when they can be found. Over the card's own link.
function LenderName({
  from,
  asking,
  onAsk,
}: {
  from: Lender;
  asking: boolean;
  onAsk: () => void;
}) {
  const nameClass =
    "relative z-10 font-medium text-stone-700 dark:text-stone-200 underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:underline";
  if (from.relation === "you") return <>you</>;
  if (from.relation === "friend") {
    return (
      <Link to={`/friend/${from.id}`} className={nameClass}>
        {from.name}
      </Link>
    );
  }
  if (!from.canAsk) return <>{from.name}</>;
  return (
    <button type="button" aria-expanded={asking} onClick={onAsk} className={nameClass}>
      {from.name}
    </button>
  );
}

// Asking a lender you don't know yet to be friends, under their book
function FriendPrompt({ from }: { from: Lender }) {
  const fetcher = useFetcher();
  const first = from.name.split(" ")[0];
  const sent = from.asked || fetcher.state !== "idle" || fetcher.data !== undefined;
  // Once they're a friend, their name is a link to their shelf instead
  if (from.relation !== "other") return null;
  return (
    <div className="relative z-10 mt-2 flex items-center gap-3 rounded-md bg-stone-100 dark:bg-stone-800 px-3 py-2 text-sm text-stone-600 dark:text-stone-300">
      <p className="min-w-0 flex-1 text-pretty">
        {from.asked && fetcher.data === undefined
          ? `There's a friend request waiting between you and ${first}.`
          : sent
            ? `Friend request sent. Once ${first} says yes, you'll see their shelf.`
            : `You and ${first} aren't friends yet. Add them to see their shelf.`}
      </p>
      {!sent ? (
        <button
          type="button"
          onClick={() =>
            fetcher.submit({ friendId: from.id }, { method: "post", action: "/friends/add" })
          }
          className="flex-shrink-0 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-950 px-2.5 py-1 text-xs text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors"
        >
          Add friend
        </button>
      ) : null}
    </div>
  );
}

// ---- "What did you think?" at the top of the feed ----

type PromptBook = Awaited<ReturnType<typeof getNotePrompts>>[number];

// Something to answer, rather than a blank box. Picked by book, so the
// same book keeps the same question. Each fits on one line on a phone.
const QUESTIONS = [
  "Worth the hype? Who should read it?",
  "Slow start? Great ending? Say so.",
  "What stayed with you?",
  "Loved it, hated it, or in between?",
  "What should the next reader know?",
];
const questionFor = (id: string) =>
  QUESTIONS[
    [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) %
      QUESTIONS.length
  ];

// A book you borrowed or marked read and haven't written about, with a
// place to do it. Saving or skipping moves on to the next one.
export function NotePrompt({ books, userId }: { books: PromptBook[]; userId: string }) {
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
            {book.read
              ? book.owner.id === userId
                ? "You marked it read. Friends who borrow it will see your note."
                : `You marked it read. Your note stays with ${book.owner.firstname}'s copy.`
              : `${book.returned ? "You borrowed it" : "You're borrowing it"} from ${book.owner.firstname}. Your note stays with the book for the next reader.`}
          </p>
        </div>
      </div>
      <div>
        <fetcher.Form
          method="post"
          action="/feed"
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
              className={`${primaryButton("md")} disabled:cursor-wait`}
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
