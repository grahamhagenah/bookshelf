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
  corner,
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
  // A small control in the top corner, like To read's ×, out of the way of
  // the title and the buttons
  corner?: React.ReactNode;
  className?: string;
}) {
  return (
    <li
      id={id}
      className={`relative flex items-start gap-4 border-b border-stone-100 dark:border-stone-800 py-4 ${className}`}
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
          className={`self-start font-medium text-stone-900 dark:text-stone-100 underline-offset-2 hover:underline ${corner ? "pr-7" : ""}`}
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
      {corner ? <div className="absolute right-0 top-3">{corner}</div> : null}
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

// Your own marks on a book, as History and Also read offer them: one
// button in two parts, a heart you can give or take back right there,
// and the way to your note (or to leave one). loveAction is the page that
// saves the heart; without one, the heart only shows
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
  // What was just pressed shows at once, before the page catches up
  const pending = love.formData?.get("loved");
  const isLoved = pending ? pending === "true" : loved;
  const part =
    "inline-flex h-[30px] items-center gap-1.5 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors";
  const heart = (
    <HeartIcon
      size={13}
      filled={isLoved}
      className={isLoved ? "text-rose-400" : "text-stone-400 dark:text-stone-500"}
    />
  );
  return (
    <span className="inline-flex divide-x divide-stone-200 overflow-hidden rounded-md border border-stone-200 dark:divide-stone-700 dark:border-stone-700">
      {loveAction ? (
        <love.Form method="post" action={loveAction} className="flex">
          <input type="hidden" name="intent" value="toggleLove" />
          <input type="hidden" name="loved" value={isLoved ? "false" : "true"} />
          <button
            type="submit"
            aria-label={isLoved ? "Loved" : "Love it"}
            aria-pressed={isLoved}
            title={isLoved ? "Loved. Take the heart back" : "Love it"}
            className={`${part} px-2`}
          >
            {heart}
          </button>
        </love.Form>
      ) : (
        <span className={`${part} px-2`}>{heart}</span>
      )}
      <Link to={notes} className={`${part} px-2.5 font-medium`}>
        {hasNote ? "Read your note" : "Leave a note"}
      </Link>
    </span>
  );
}
