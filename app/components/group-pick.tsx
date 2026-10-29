import { useState } from "react";
import { Link, useFetcher } from "react-router";

import type { getGroupPick } from "~/models/group-pick.server";
import type { LoaderData } from "~/utils";
import { workPath } from "~/utils";

import BookCover from "./book-cover";
import { quietButton } from "./ui";

type Pick = NonNullable<LoaderData<Awaited<ReturnType<typeof getGroupPick>>>>;

// A list of names: "Ben", "Ben and Cal", "Ben, Cal and Dee"
const names = (people: string[]) =>
  people.length <= 1
    ? people.join("")
    : `${people.slice(0, -1).join(", ")} and ${people[people.length - 1]}`;

const meetingDate = (date: string | Date) =>
  new Date(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

// What the group is reading now, at the top of its page: the book, when
// they meet, the one thing to do about a copy, how many have finished,
// and a line or two from those who have. With no pick yet, how to make one.
export default function GroupPick({
  pick,
  path,
  groupName,
  userId,
}: {
  pick: Pick | null;
  path: string;
  groupName: string;
  userId: string;
}) {
  const fetcher = useFetcher();
  const [dating, setDating] = useState(false);

  if (!pick) {
    return (
      <section className="mb-6 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 px-4 py-3 text-sm text-stone-500 dark:text-stone-400">
        <span className="font-medium text-stone-700 dark:text-stone-200">What&apos;s {groupName} reading?</span>{" "}
        Find a book and choose <span className="font-medium">Pick for {groupName}</span> on its page.{" "}
        <Link to="/search" className="underline underline-offset-2 hover:text-stone-800 dark:hover:text-stone-200">
          Find a book
        </Link>
      </section>
    );
  }

  const page = workPath(pick.key) ?? `/search?q=${encodeURIComponent(`${pick.title} ${pick.author}`)}`;
  const mine = pick.copies.find((copy) => copy.mine);
  const borrowing = pick.copies.find((copy) => copy.borrowerId === userId);
  const free = pick.copies.find((copy) => !copy.mine && copy.available);
  const out = pick.copies.find((copy) => !copy.mine && !copy.notLending);
  // The one thing to do about getting a copy
  const copyLine = mine ? (
    <span>You have a copy</span>
  ) : borrowing ? (
    <span>You&apos;re borrowing {borrowing.owner.firstname}&apos;s</span>
  ) : free ? (
    <Link to={`/books/${free.bookId}`} className={`${quietButton("sm")} inline-flex items-center font-medium`}>
      Ask {free.owner.firstname} to borrow it
    </Link>
  ) : out ? (
    <Link to={`/books/${out.bookId}`} className={`${quietButton("sm")} inline-flex items-center font-medium`}>
      Get in line for {out.owner.firstname}&apos;s
    </Link>
  ) : (
    <span>Nobody in the group has a copy yet</span>
  );
  const others = pick.copies.filter((copy) => copy !== mine && copy !== free && copy !== out && copy !== borrowing);

  // One labeled field of the card's right half
  const field = (label: string, body: React.ReactNode, wide = false) => (
    <div className={wide ? "col-span-2" : ""}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">{label}</dt>
      <dd className="mt-1 text-sm text-stone-600 dark:text-stone-300">{body}</dd>
    </div>
  );

  return (
    // The book on one side, what the group needs to read it on the other;
    // stacked on phones
    <section
      aria-labelledby="group-pick"
      className="mb-6 grid overflow-hidden rounded-xl border border-stone-200 dark:border-stone-800 md:grid-cols-2"
    >
      <div className="flex gap-4 p-4">
        <Link to={page} tabIndex={-1} aria-hidden="true" className="flex-shrink-0">
          <BookCover cover={pick.cover} title={pick.title} author={pick.author} className="h-[123px] w-[82px]" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <p id="group-pick" className="text-xs font-semibold uppercase tracking-wide text-stone-500 dark:text-stone-400">
            Reading now
          </p>
          <Link
            to={page}
            className="mt-0.5 font-semibold leading-snug text-stone-900 dark:text-stone-100 underline-offset-2 hover:underline"
          >
            {pick.title}
          </Link>
          <p className="text-sm text-stone-500 dark:text-stone-400">{pick.author}</p>
          <p className="mt-auto pt-3 text-xs text-stone-400 dark:text-stone-500">
            {pick.pickedBy ? `Picked by ${pick.pickedBy.id === userId ? "you" : pick.pickedBy.firstname}. ` : null}
            To change it, choose Pick for {groupName} on another book&apos;s page.{" "}
            <fetcher.Form method="post" action={path} className="inline">
              <input type="hidden" name="intent" value="clearPick" />
              <button type="submit" className="underline underline-offset-2 hover:text-stone-700 dark:hover:text-stone-300">
                Clear it
              </button>
            </fetcher.Form>
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-2 content-start gap-x-6 gap-y-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-900/40 p-4 md:border-l md:border-t-0">
        {field(
          "Meeting",
          dating ? (
            <fetcher.Form
              method="post"
              action={path}
              className="flex flex-wrap items-center gap-2"
              onSubmit={() => setDating(false)}
            >
              <input type="hidden" name="intent" value="meeting" />
              <label htmlFor="meets-at" className="sr-only">
                Meeting date
              </label>
              <input
                id="meets-at"
                type="date"
                name="meetsAt"
                defaultValue={pick.meetsAt ? new Date(pick.meetsAt).toISOString().slice(0, 10) : ""}
                className="h-8 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 text-sm text-stone-900 dark:text-stone-100"
              />
              <button type="submit" className={quietButton("sm")}>
                Save
              </button>
              {pick.meetsAt ? (
                <button type="submit" name="meetsAt" value="" className="text-sm text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200">
                  No date
                </button>
              ) : null}
              <button type="button" onClick={() => setDating(false)} className="text-sm text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200">
                Cancel
              </button>
            </fetcher.Form>
          ) : pick.meetsAt ? (
            <button type="button" onClick={() => setDating(true)} className="font-medium text-stone-800 dark:text-stone-100 underline-offset-2 hover:underline">
              {meetingDate(pick.meetsAt)}
            </button>
          ) : (
            <button type="button" onClick={() => setDating(true)} className="underline underline-offset-2 hover:text-stone-800 dark:hover:text-stone-100">
              Set a date
            </button>
          ),
          dating,
        )}
        {dating
          ? null
          : field(
              "Finished",
              pick.finished.length > 0 ? (
                <>
                  <span className="font-medium text-stone-800 dark:text-stone-100">
                    {pick.finished.length} of {pick.memberCount}
                  </span>{" "}
                  · {names(pick.finished.map((m) => (m.id === userId ? "you" : m.firstname)))}
                </>
              ) : (
                "Nobody yet"
              ),
            )}
        {field(
          "Copies",
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {copyLine}
            {others.length > 0 ? (
              <span>
                Also {names(others.map((copy) => copy.owner.firstname))}
                {others.length === 1 ? " has one" : " have copies"}
              </span>
            ) : null}
          </span>,
          true,
        )}
        {pick.notes.length > 0
          ? field(
              "What they thought",
              <ul className="space-y-1">
                {pick.notes.slice(0, 2).map((note) => (
                  <li key={note.userId} className="text-stone-700 dark:text-stone-300">
                    &ldquo;{note.body}&rdquo;{" "}
                    <span className="text-stone-500 dark:text-stone-400">
                      {note.userId === userId ? "you" : note.firstname}
                    </span>
                  </li>
                ))}
              </ul>,
              true,
            )
          : null}
      </dl>
    </section>
  );
}
