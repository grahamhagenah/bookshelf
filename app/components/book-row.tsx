import { Link, useFetcher } from "react-router";

import BookCover from "./book-cover";
import { HeartIcon } from "./icons";
import { quietButton } from "./ui";

// One book in one of your lists (To read, Also read, History), the same
// way in each: the cover, the title and author, a line on where it stands,
// then what you can do with it. Names and dates in the line stand out a
// little; the thing to do next is a button, anything else quiet.

// The lists' columns: one on phones, two on a tablet, three on a desktop
export const bookRowGrid = "grid gap-x-8 md:grid-cols-2 lg:grid-cols-3";

// A name, date or link inside a book's line
export const rowEmphasis = "font-medium text-stone-700 dark:text-stone-200";

// What the row is waiting for (getting a copy, leaving a note), as a
// button of its own
export const rowPrimary = `${quietButton("sm")} inline-flex items-center font-medium`;
// Anything else you can do: remove it, read a note
export const rowSecondary =
  "text-stone-500 underline-offset-4 decoration-stone-300 hover:text-stone-800 hover:underline dark:text-stone-400 dark:decoration-stone-600 dark:hover:text-stone-100 transition-colors";

export function BookRow({
  id,
  to,
  book,
  line,
  actions,
  className = "",
}: {
  id?: string;
  // The book's own page, from its cover and title
  to: string;
  book: { title: string; author: string; cover: string };
  // Where it stands: one RowLine
  line?: React.ReactNode;
  // What you can do, in rowPrimary or rowSecondary
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <li
      id={id}
      className={`flex items-start gap-4 border-b border-stone-100 dark:border-stone-800 py-4 ${className}`}
    >
      <Link to={to} tabIndex={-1} aria-hidden="true" className="flex-shrink-0">
        <BookCover
          cover={book.cover}
          title={book.title}
          author={book.author}
          className="h-36 w-24"
        />
      </Link>
      {/* As tall as the cover at least, so what you can do sits along its
          bottom edge, row after row */}
      <div className="flex min-h-36 min-w-0 flex-1 flex-col">
        <Link
          to={to}
          className="self-start font-medium text-stone-900 dark:text-stone-100 underline-offset-2 hover:underline"
        >
          {book.title}
        </Link>
        <p className="text-sm text-stone-500 dark:text-stone-400">{book.author}</p>
        {line ? <div className="mt-2">{line}</div> : null}
        {actions ? (
          <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-3 text-sm">
            {actions}
          </div>
        ) : null}
      </div>
    </li>
  );
}

// Where a book stands, in a line or two of quiet words
export function RowLine({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-stone-500 dark:text-stone-400">{children}</p>;
}

// A heart and who loved it, the same in every list: "You loved it",
// "Maya loved it"
export function RowLoved({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <HeartIcon size={12} filled className="flex-shrink-0 text-rose-400" />
      {children}
    </span>
  );
}

// A date in a row: "Oct 1", with the year only when it isn't this one
export function rowDate(date: string | Date) {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
}

// The quieter second line of a book's line: when, or how it stands
export function RowSub({ children }: { children: React.ReactNode }) {
  return <span className="block text-stone-400 dark:text-stone-500">{children}</span>;
}

// The way to a book's notes, with a heart in it when the book was loved
export function NoteButton({
  to,
  loved,
  children,
}: {
  to: string;
  loved: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link to={to} className={`${rowPrimary} gap-1.5`}>
      {loved ? <HeartIcon size={13} filled className="flex-shrink-0 text-rose-400" /> : null}
      {children}
    </Link>
  );
}

// Your own marks on a book, as History and Also read offer them: the way
// to your note (or to leave one), and until you've loved it, a heart to
// give right there. loveAction is the page that saves the heart
export function YourNoteActions({
  notes,
  loveAction,
  loved,
  hasNote,
}: {
  notes: string;
  loveAction?: string;
  loved: boolean;
  hasNote: boolean;
}) {
  const love = useFetcher();
  // A heart given from the row shows at once
  const isLoved = loved || love.state !== "idle";
  return (
    <>
      <NoteButton to={notes} loved={isLoved}>
        {hasNote ? "Read your note" : "Leave a note"}
      </NoteButton>
      {isLoved || !loveAction ? null : (
        <love.Form method="post" action={loveAction}>
          <input type="hidden" name="intent" value="toggleLove" />
          <input type="hidden" name="loved" value="true" />
          <button
            type="submit"
            aria-label="Love it"
            title="Love it"
            // A square the button's height, in the same outline as the button
            className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-md border border-stone-200 text-stone-500 hover:border-stone-400 hover:text-rose-400 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-500 transition-colors"
          >
            <HeartIcon size={13} />
          </button>
        </love.Form>
      )}
    </>
  );
}
