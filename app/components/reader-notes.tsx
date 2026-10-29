import { Fragment, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useFetcher } from "react-router";

import { PIN_MAX } from "~/profile";

import Avatar from "./avatar";
import { HeartIcon, HiddenIcon, PinIcon, ReadIcon } from "./icons";
import PersonLink from "./person-link";
import { quietButton, sectionHeading } from "./ui";

interface ReaderNote {
  id: string;
  loved: boolean;
  body: string | null;
  updatedAt: string | Date;
  user: {
    id: string;
    firstname: string;
    surname: string;
    profileEmoji: string | null;
  };
  // How they know the book, on a copy's page: "Borrowed this copy in
  // March", "Read it elsewhere"
  context?: string | null;
}

const formatDate = (date: string | Date) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

// Your own marks on a book (a heart, having read it) share one look: a
// small rounded toggle, tinted once it's on
const chip = (on: string | false) =>
  `inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
    on ||
    "border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-stone-400 dark:hover:border-stone-500"
  }`;

const LOVE_FETCHER = "reader-love";

function useLoved(myNote: ReaderNote | null) {
  const fetcher = useFetcher({ key: LOVE_FETCHER });
  // Show the heart's new state straight away, before the server answers
  const pendingLoved = fetcher.formData?.get("loved");
  const loved =
    pendingLoved !== undefined && pendingLoved !== null
      ? pendingLoved === "true"
      : (myNote?.loved ?? false);
  return { fetcher, loved };
}

// Who loved it, the way a reaction count reads: "Anika", "Maya and Anika",
// "You, Maya, and Anika", then "You, Maya, and 3 others" past three, so it
// stays one short line. Three or more get the Oxford comma.
function lovedBy(names: ReactNode[]) {
  const shown = names.length > 3 ? names.slice(0, 2) : names;
  const rest = names.length - shown.length;
  const parts = rest > 0 ? [...shown, `${rest} others`] : shown;
  const last = parts.length > 2 ? ", and " : " and ";
  return parts.map((part, index) => (
    <Fragment key={index}>
      {index === 0 ? null : index === parts.length - 1 ? last : ", "}
      {part}
    </Fragment>
  ));
}

// Your heart for this copy, for anyone who's read it. Once it's given, it
// names everyone else who gave one too.
function HeartToggle({
  myNote,
  others,
}: {
  myNote: ReaderNote | null;
  // First names of the others who loved it
  others: string[];
}) {
  const { fetcher, loved } = useLoved(myNote);
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="toggleLove" />
      <input type="hidden" name="loved" value={loved ? "false" : "true"} />
      <button
        type="submit"
        aria-pressed={loved}
        title={loved ? "Take back your heart" : "Love it"}
        className={chip(
          loved &&
            "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300",
        )}
      >
        <HeartIcon
          size={14}
          filled={loved}
          className={loved ? "text-rose-500" : ""}
        />
        {loved ? <>{lovedBy(["You", ...others])} loved it</> : "Love it"}
      </button>
    </fetcher.Form>
  );
}

// Having read it: yours alone, for your library's Read filter and your
// exports, so friends never see it
function ReadToggle({ readAt }: { readAt: string | Date | null }) {
  const fetcher = useFetcher({ key: "read" });
  const pending = fetcher.formData?.get("read");
  const read = pending ? pending === "true" : Boolean(readAt);
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="toggleRead" />
      <input type="hidden" name="read" value={read ? "false" : "true"} />
      <button
        type="submit"
        aria-pressed={read}
        title={
          read ? "Mark as not read. Only you see this." : "Only you see this"
        }
        className={chip(
          read &&
            "border-forest-600/25 bg-forest-600/10 text-forest-700 dark:border-forest-400/30 dark:bg-forest-400/15 dark:text-forest-400",
        )}
      >
        {/* Like the heart's "You loved it". Both labels share one cell, so
            the button keeps its width and the row doesn't shift. No date:
            when you marked it isn't always when you read it */}
        <span className="grid justify-items-center">
          <span
            className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 ${read ? "invisible" : ""}`}
          >
            <ReadIcon size={14} />
            Mark as read
          </span>
          <span
            className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 ${read ? "" : "invisible"}`}
          >
            <ReadIcon size={14} />
            You read it
          </span>
        </span>
      </button>
    </fetcher.Form>
  );
}

// Where this book stands on its owner's public page
export interface PageStanding {
  pinned: boolean;
  count: number;
  // From their own shelf, rather than borrowed from a friend
  own: boolean;
  // Kept off public pages (by its owner, when it's a friend's)
  hidden: boolean;
}

function usePageStanding(page: PageStanding) {
  const fetcher = useFetcher<{ pinError?: string }>({ key: "public-page" });
  const intent = fetcher.formData?.get("intent");
  // Shown as it will be, while it saves
  const pinned =
    intent === "pin" ? true : intent === "unpin" ? false : page.pinned;
  const hidden =
    intent === "hideFromPage"
      ? true
      : intent === "showOnPage"
        ? false
        : page.hidden;
  // The page's five are taken, counting this one as it's about to be
  const count = page.count + (pinned ? 1 : 0) - (page.pinned ? 1 : 0);
  const full = !pinned && count >= PIN_MAX;
  return { fetcher, pinned, hidden, full };
}

// This book's place on your public page, from the bottom of the book page:
// small outlined buttons in a row with Edit details
export const quietAction = `${quietButton("md")} inline-flex items-center gap-1.5 disabled:cursor-not-allowed [&_svg]:text-stone-400 dark:[&_svg]:text-stone-500`;

// Pinning it to the favorites at the top of your public page. Your note
// on it is what shows there with it.
export function PinToggle({ page }: { page: PageStanding }) {
  const { fetcher, pinned, hidden, full } = usePageStanding(page);
  // A book kept off the page can't be at the top of it
  const off = !pinned && hidden;
  return (
    <fetcher.Form method="post" className="inline-flex items-center gap-2">
      <input type="hidden" name="intent" value={pinned ? "unpin" : "pin"} />
      <button
        type="submit"
        disabled={full || off}
        title={
          off
            ? page.own
              ? "It's hidden from your public shelf. Show it there first."
              : "Its owner keeps it off public shelves."
            : full
              ? `Your public shelf shows ${PIN_MAX}. Unpin one in Settings first.`
              : pinned
                ? undefined
                : "Put it in the favorites at the top of your public shelf, with your note"
        }
        className={quietAction}
      >
        <PinIcon size={14} filled={pinned} />
        <span>
          {pinned ? "Unpin from my public shelf" : "Pin to my public shelf"}
        </span>
      </button>
      {fetcher.data?.pinError ? (
        <span role="alert" className="text-sm text-red-700 dark:text-red-400">
          {fetcher.data.pinError}
        </span>
      ) : null}
    </fetcher.Form>
  );
}

// Keeping one of your own books off your public page altogether. Friends
// still see it on your shelf. Whether a friend's book shows is theirs to say.
export function HideToggle({ page }: { page: PageStanding }) {
  const { fetcher, hidden } = usePageStanding(page);
  if (!page.own) return null;
  return (
    <fetcher.Form method="post">
      <button
        type="submit"
        name="intent"
        value={hidden ? "showOnPage" : "hideFromPage"}
        title={
          hidden
            ? undefined
            : "Keep it off your public shelf. Friends still see it on your shelf."
        }
        className={quietAction}
      >
        <HiddenIcon size={14} />
        <span>
          {hidden ? "Show on my public shelf" : "Hide from my public shelf"}
        </span>
      </button>
    </fetcher.Form>
  );
}

// Short notes left by the owner and everyone who has read this copy
export default function ReaderNotes({
  notes,
  myNote,
  canNote,
  maxLength,
  friendIds,
  readAt,
  limit,
  className = "mt-12 max-w-150 border-t border-stone-200 dark:border-stone-800 pt-8",
}: {
  notes: ReaderNote[];
  myNote: ReaderNote | null;
  canNote: boolean;
  maxLength: number;
  friendIds: string[];
  // When you read it, for readers of this copy
  readAt?: string | Date | null;
  // Up near the top of the page: the first few, with the rest a tap away,
  // and no heading, since the notes say what they are
  limit?: number;
  className?: string;
}) {
  const { loved } = useLoved(myNote);
  const noteFetcher = useFetcher<{ noteSaved?: boolean }>();
  const [isWriting, setIsWriting] = useState(false);

  useEffect(() => {
    if (noteFetcher.state === "idle" && noteFetcher.data?.noteSaved) {
      setIsWriting(false);
    }
  }, [noteFetcher.state, noteFetcher.data]);

  const isSaving = noteFetcher.state !== "idle";
  const written = notes.filter((note) => note.body);
  const hasNotes = written.length > 0;
  const [showAll, setShowAll] = useState(false);
  const shown = limit && !showAll ? written.slice(0, limit) : written;
  // Everyone else who gave a heart, with a note or without
  const otherHearts = notes.filter(
    (note) => note.loved && note.id !== myNote?.id,
  );

  return (
    <div className={className}>
      <h2 id="notes" className={limit ? "sr-only" : `${sectionHeading} mb-3`}>
        Reader notes
      </h2>
      {/* Having read it comes first, then your heart, beside one count of
          everyone who's given one (like a reaction count, whether they
          wrote a note or not) */}
      {canNote || otherHearts.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {canNote && readAt !== undefined ? (
            <ReadToggle readAt={readAt} />
          ) : null}
          {canNote ? (
            <HeartToggle
              myNote={myNote}
              others={otherHearts.map((note) => note.user.firstname)}
            />
          ) : null}
          {/* Once you've given yours, your heart names them instead */}
          {otherHearts.length > 0 && !(canNote && loved) ? (
            <p className="inline-flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400">
              <HeartIcon size={13} filled className="text-rose-400" />
              <span>
                {lovedBy(
                  otherHearts.map((note) => (
                    <PersonLink
                      key={note.id}
                      id={note.user.id}
                      name={note.user.firstname}
                      friendIds={friendIds}
                    />
                  )),
                )}{" "}
                loved it
              </span>
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Not one more button: an empty note, waiting. It looks like the
          box it opens, with the same words, so tapping it just wakes it. */}
      {canNote && !myNote?.body && !isWriting ? (
        <button
          type="button"
          onClick={() => setIsWriting(true)}
          className="mb-4 block w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-left leading-relaxed text-stone-400 dark:text-stone-500 hover:border-stone-300 dark:hover:border-stone-600 transition-colors"
        >
          What did you think? A line or two for the next reader.
        </button>
      ) : null}

      {isWriting ? (
        <noteFetcher.Form method="post" className="mb-6">
          <input type="hidden" name="intent" value="saveNote" />
          <label htmlFor="note-body" className="sr-only">
            Your note
          </label>
          <textarea
            id="note-body"
            name="body"
            rows={3}
            maxLength={maxLength}
            defaultValue={myNote?.body ?? ""}
            placeholder="What did you think? A line or two for the next reader."
            className="block w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 leading-relaxed text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            required
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className={`rounded-md bg-forest-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-forest-700 transition-colors ${isSaving ? "opacity-60 cursor-wait" : ""}`}
            >
              {isSaving ? "Saving…" : "Save note"}
            </button>
            <button
              type="button"
              onClick={() => setIsWriting(false)}
              className="rounded-md px-2 py-1.5 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </noteFetcher.Form>
      ) : null}

      {hasNotes ? (
        <ul className="space-y-3">
          {shown.map((note) => {
              const isMine = note.id === myNote?.id;
              if (isMine && isWriting) return null;
              return (
                <li
                  key={note.id}
                  className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 px-4 py-3.5"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      firstname={note.user.firstname}
                      surname={note.user.surname}
                      icon={note.user.profileEmoji}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 leading-snug">
                        <span className="font-semibold text-stone-900 dark:text-stone-100">
                          {isMine ? (
                            "You"
                          ) : (
                            <PersonLink
                              id={note.user.id}
                              name={`${note.user.firstname} ${note.user.surname}`}
                              friendIds={friendIds}
                            />
                          )}
                        </span>
                        <span className="text-stone-600 dark:text-stone-300">
                          {(isMine ? loved : note.loved)
                            ? "loved it"
                            : "wrote about it"}
                        </span>
                        {(isMine ? loved : note.loved) ? (
                          <HeartIcon
                            size={13}
                            filled
                            className="text-rose-400"
                          />
                        ) : null}
                        <span className="text-stone-400 dark:text-stone-500">
                          {" "}
                          ·{" "}
                        </span>
                        <span className="text-sm text-stone-400 dark:text-stone-500">
                          {formatDate(note.updatedAt)}
                        </span>
                      </p>
                      {note.context ? (
                        <p className="mt-0.5 text-sm leading-snug text-stone-500 dark:text-stone-400">
                          {note.context}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <p className="mt-3 text-pretty leading-relaxed text-stone-800 dark:text-stone-200 whitespace-pre-wrap break-words">
                    {note.body}
                  </p>
                  {isMine ? (
                    <div className="mt-3 flex gap-4 border-t border-stone-100 dark:border-stone-800 pt-2 text-sm">
                      <button
                        type="button"
                        onClick={() => setIsWriting(true)}
                        className="text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
                      >
                        Edit
                      </button>
                      <noteFetcher.Form method="post">
                        <input type="hidden" name="intent" value="deleteNote" />
                        <button
                          type="submit"
                          className="text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
                        >
                          Remove
                        </button>
                      </noteFetcher.Form>
                    </div>
                  ) : null}
                </li>
              );
            })}
          {shown.length < written.length ? (
            <li>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-sm font-medium text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white underline-offset-4 hover:underline"
              >
                Show all {written.length} notes
              </button>
            </li>
          ) : null}
        </ul>
      ) : !canNote && otherHearts.length === 0 ? (
        <p className="py-2 text-sm text-stone-400 dark:text-stone-500">
          No notes yet.
        </p>
      ) : null}
    </div>
  );
}
