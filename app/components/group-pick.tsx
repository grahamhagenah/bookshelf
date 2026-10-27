import { useEffect, useState } from "react";
import { Link, useFetcher } from "react-router";

import { daysUntil, dueText } from "~/due";
import type { SuggestResponse } from "~/routes/api.search-suggest";

import BookCover from "./book-cover";
import { primaryButton, quietButton } from "./ui";

// What a group's reading now, at the top of its page: the book, a line
// about it, and every copy in the group, so a book club can see who has
// one and get in line for it. Anyone in the group can pick the book.

interface Copy {
  id: string;
  owner: string;
  mine: boolean;
  borrower: string | null;
  borrowedByMe: boolean;
  dueDate: string | Date | null;
  notLending: boolean;
  waiting: number;
  inLine: boolean;
}

export interface GroupPickData {
  key: string;
  title: string;
  author: string | null;
  cover: string | null;
  note: string | null;
  copies: Copy[];
}

const quietLink =
  "text-stone-500 dark:text-stone-400 underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-900 dark:hover:text-stone-100 hover:underline";

export default function GroupPick({
  pick,
  groupName,
  path,
}: {
  pick: GroupPickData | null;
  groupName: string;
  path: string;
}) {
  const [choosing, setChoosing] = useState(false);
  const clear = useFetcher();

  if (choosing) {
    return (
      <PickForm
        path={path}
        groupName={groupName}
        note={pick?.note ?? ""}
        onDone={() => setChoosing(false)}
      />
    );
  }

  if (!pick) {
    return (
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-stone-300 dark:border-stone-700 px-4 py-3 text-sm">
        <p className="text-stone-600 dark:text-stone-300">
          Reading a book together? Pick it, and see who has a copy.
        </p>
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className={quietButton("md")}
        >
          Pick a book
        </button>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="reading-now"
      className="mb-6 flex gap-4 rounded-lg border border-stone-200 dark:border-stone-800 p-4"
    >
      <Link to={pick.key} className="flex-shrink-0">
        <BookCover
          cover={pick.cover}
          title={pick.title}
          author={pick.author}
          className="w-12 h-[72px]"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <p
          id="reading-now"
          className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400"
        >
          Reading now
        </p>
        <p className="mt-0.5 font-medium text-stone-900 dark:text-stone-100">
          <Link to={pick.key} className="hover:underline underline-offset-2">
            {pick.title}
          </Link>
          {pick.author ? (
            <span className="font-normal text-stone-500 dark:text-stone-400">
              {" "}
              · {pick.author}
            </span>
          ) : null}
        </p>
        {pick.note ? (
          <p className="mt-0.5 text-sm text-stone-700 dark:text-stone-300">
            {pick.note}
          </p>
        ) : null}

        <ul className="mt-2 space-y-1 text-sm">
          {pick.copies.length === 0 ? (
            <li className="text-stone-500 dark:text-stone-400">
              No one here has a copy yet.{" "}
              <Link to={pick.key} className={quietLink}>
                Add it to your want-to-read list
              </Link>{" "}
              to hear when someone does.
            </li>
          ) : (
            pick.copies.map((copy) => (
              <li key={copy.id} className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-stone-800 dark:text-stone-200">
                  {copy.mine ? "Your copy" : `${copy.owner}'s copy`}
                </span>
                <span className="text-stone-500 dark:text-stone-400">
                  {where(copy)}
                </span>
                {!copy.mine && !copy.borrowedByMe && !copy.notLending ? (
                  <Link to={`/books/${copy.id}`} className={quietLink}>
                    {copy.borrower
                      ? copy.inLine
                        ? "You're in line"
                        : "Get in line"
                      : "Ask to borrow"}
                  </Link>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
      <div className="flex flex-shrink-0 flex-col items-end gap-1 text-sm">
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className={quietLink}
        >
          Change
        </button>
        <clear.Form method="post" action={path}>
          <button
            type="submit"
            name="intent"
            value="clearPick"
            className={quietLink}
          >
            Done reading
          </button>
        </clear.Form>
      </div>
    </section>
  );
}

// Where a copy is: on its shelf, or with someone and till when. A late
// one's lateness is between its owner and borrower, so others just see
// who has it.
function where(copy: Copy) {
  if (copy.borrower) {
    const who = copy.borrowedByMe ? "with you" : `with ${copy.borrower}`;
    const showDue =
      copy.dueDate && (copy.mine || copy.borrowedByMe || daysUntil(copy.dueDate) >= 0);
    const due = showDue && copy.dueDate ? `, ${dueText(copy.dueDate)}` : "";
    const line =
      copy.waiting > 0
        ? ` · ${copy.waiting} waiting`
        : "";
    return `${who}${due}${line}`;
  }
  if (copy.notLending) return "not lending right now";
  return copy.mine ? "on your shelf" : "on the shelf";
}

// Choosing the book: the search box's suggestions, which come back at
// once for books Stacks already knows, and a line to go with it
function PickForm({
  path,
  groupName,
  note: initialNote,
  onDone,
}: {
  path: string;
  groupName: string;
  note: string;
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [note, setNote] = useState(initialNote);
  // As the search box: the books Stacks knows come back at once, Open
  // Library's join them after
  const quick = useFetcher<SuggestResponse>();
  const suggest = useFetcher<SuggestResponse>();
  const save = useFetcher<{ ok?: boolean; error?: string }>();

  const typed = query.trim();
  useEffect(() => {
    if (typed.length < 2) return;
    const timer = setTimeout(() => {
      const q = encodeURIComponent(typed);
      quick.load(`/api/search-suggest?q=${q}`);
      suggest.load(`/api/search-suggest?q=${q}&source=openLibrary`);
    }, 200);
    return () => clearTimeout(timer);
    // fetcher.load is stable enough here; re-running on it would loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed]);

  // Saved: back to the card
  useEffect(() => {
    if (save.state === "idle" && save.data?.ok) onDone();
  }, [save.state, save.data, onDone]);

  const answer =
    suggest.data?.query === typed
      ? suggest.data
      : quick.data?.query === typed
        ? quick.data
        : null;
  const books =
    typed.length >= 2 && answer
      ? answer.openLibrary.filter((book) => book.key)
      : [];
  const field =
    "h-9 w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 text-sm text-stone-800 dark:text-stone-200 focus:outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10";

  return (
    <section className="mb-6 rounded-lg border border-stone-200 dark:border-stone-800 p-4">
      <h2 className="font-semibold text-stone-900 dark:text-stone-100">
        What&apos;s {groupName} reading?
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium text-stone-500 dark:text-stone-400">
          The book
          <input
            // Opened to search, so the cursor starts here
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Title or author"
            autoComplete="off"
            className={`mt-1 ${field}`}
          />
        </label>
        <label className="block text-xs font-medium text-stone-500 dark:text-stone-400">
          A line about it <span className="font-normal">(optional)</span>
          <input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="We meet on the 12th, at Ruth's"
            maxLength={120}
            className={`mt-1 ${field}`}
          />
        </label>
      </div>
      {books.length > 0 ? (
        <ul className="mt-3 divide-y divide-stone-100 dark:divide-stone-800">
          {books.map((book) => (
            <li key={book.key} className="flex items-center gap-3 py-2">
              <BookCover
                cover={
                  book.coverId
                    ? `https://covers.openlibrary.org/b/id/${book.coverId}-L.jpg`
                    : null
                }
                title={book.title}
                author={book.author}
                className="w-8 h-12 flex-shrink-0"
              />
              <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate font-medium text-stone-900 dark:text-stone-100">
                  {book.title}
                </span>
                <span className="block truncate text-stone-500 dark:text-stone-400">
                  {[book.author, book.year].filter(Boolean).join(" · ")}
                </span>
              </span>
              <button
                type="button"
                disabled={save.state !== "idle"}
                onClick={() =>
                  save.submit(
                    {
                      intent: "setPick",
                      key: book.key ?? "",
                      title: book.title,
                      author: book.author ?? "",
                      cover: book.coverId
                        ? `https://covers.openlibrary.org/b/id/${book.coverId}-L.jpg`
                        : "",
                      note,
                    },
                    { method: "post", action: path },
                  )
                }
                className={`${primaryButton("md")} disabled:opacity-60`}
              >
                Pick this
              </button>
            </li>
          ))}
        </ul>
      ) : typed.length >= 2 && suggest.state !== "idle" ? (
        <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">Looking…</p>
      ) : null}
      {save.data?.error ? (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {save.data.error}
        </p>
      ) : null}
      <button type="button" onClick={onDone} className={`mt-3 ${quietButton("md")}`}>
        Cancel
      </button>
    </section>
  );
}
