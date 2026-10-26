import { Link, useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";

import { PIN_MAX } from "~/profile";

import Avatar from "./avatar";
import { HeartIcon, HiddenIcon, PencilIcon, PinIcon, ReadIcon } from "./icons";
import PersonLink from "./person-link";
import { sectionHeading } from "./ui";

interface ReaderNote {
  id: string;
  loved: boolean;
  body: string | null;
  updatedAt: string;
  user: {
    id: string;
    firstname: string;
    surname: string;
    profileEmoji: string | null;
  };
}

const formatDate = (date: string) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

// Your own marks on a book (a heart, having read it, a note) share one
// look: a small rounded toggle, tinted once it's on
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

// Your heart for this copy, for anyone who's read it
function HeartToggle({ myNote }: { myNote: ReaderNote | null }) {
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
        {loved ? "You loved it" : "Love it"}
      </button>
    </fetcher.Form>
  );
}

// Having read it: yours alone, for your library's Read filter and your
// exports, so friends never see it
function ReadToggle({ readAt }: { readAt: string | null }) {
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
  hasNote: boolean;
  count: number;
  // From their own shelf, rather than borrowed from a friend
  own: boolean;
  // Kept off public pages (by its owner, when it's a friend's)
  hidden: boolean;
  on: boolean;
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

// Why it can't be pinned when the page's favorites are all taken, and
// where to make room
function FullNote({
  className,
  after = false,
}: {
  className: string;
  after?: boolean;
}) {
  return (
    <span>
      {after ? (
        <span aria-hidden="true" className="mr-1.5">
          ·
        </span>
      ) : null}
      Favorites full ({PIN_MAX} of {PIN_MAX}).{" "}
      <Link to="/account#pinned" className={className}>
        Unpin one
      </Link>
    </span>
  );
}

// Pinning it to the favorites at the top of your public page, beside the
// heart and the read mark, since it's another thing you say about it.
// Your note on it is what shows there with it.
function PinToggle({ page }: { page: PageStanding }) {
  const { fetcher, pinned, hidden, full } = usePageStanding(page);
  // A book kept off the page can't be at the top of it
  const off = !pinned && hidden;
  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value={pinned ? "unpin" : "pin"} />
      <button
        type="submit"
        aria-pressed={pinned}
        disabled={full || off}
        title={
          off
            ? page.own
              ? "It's kept off your public page. Show it there first."
              : "Its owner keeps it off public pages."
            : full
              ? `Your public page shows ${PIN_MAX}. Unpin one in Settings first.`
              : pinned
                ? "Unpin it from your public page"
                : "Put it in the favorites at the top of your public page, with your note"
        }
        className={`${chip(
          pinned &&
            "border-stone-300 bg-stone-100 text-stone-800 dark:border-stone-600 dark:bg-stone-800 dark:text-stone-100",
        )} disabled:cursor-not-allowed disabled:opacity-50`}
      >
        {/* Both labels share one cell, so the row doesn't shift */}
        <span className="grid justify-items-center">
          <span
            className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 ${pinned ? "invisible" : ""}`}
          >
            <PinIcon size={14} />
            Pin to my page
          </span>
          <span
            className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 ${pinned ? "" : "invisible"}`}
          >
            <PinIcon size={14} filled />
            Pinned to my page
          </span>
        </span>
      </button>
    </fetcher.Form>
  );
}

// One quiet line under the buttons, for the owner: is this book on their
// public page at all, and the switch to keep it off
function PageLine({ page }: { page: PageStanding }) {
  const { fetcher, pinned, hidden, full } = usePageStanding(page);
  const link =
    "underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-900 dark:hover:text-stone-100";
  // A friend's book: whether it's shown at all is theirs to say, so
  // there's only something to say once it's pinned, or can't be
  if (!page.own) {
    if (!pinned && !hidden && !full) return null;
    if (full && !hidden) {
      return (
        <p className="mb-4 text-xs text-stone-500 dark:text-stone-400">
          <FullNote className={link} />
        </p>
      );
    }
    return (
      <p className="mb-4 text-xs text-stone-500 dark:text-stone-400">
        {hidden
          ? pinned
            ? "Pinned, but its owner keeps it off public pages, so it isn't shown"
            : "Its owner keeps it off public pages"
          : page.hasNote
            ? "Pinned to your public page, with your note. Who lent it isn't shown"
            : "Pinned to your public page. Leave a note to show with it"}
        {page.on ? null : " (yours is off for now)"}.
        {fetcher.data?.pinError ? (
          <span role="alert" className="ml-1.5 text-red-700 dark:text-red-400">
            {fetcher.data.pinError}
          </span>
        ) : null}
      </p>
    );
  }
  return (
    <fetcher.Form
      method="post"
      className="mb-4 flex flex-wrap items-center gap-x-1.5 text-xs text-stone-500 dark:text-stone-400"
    >
      {hidden ? <HiddenIcon size={12} className="flex-shrink-0" /> : null}
      <span>
        {hidden
          ? "Kept off your public page"
          : pinned
            ? page.hasNote
              ? "Pinned to your public page, with your note"
              : "Pinned to your public page. Leave a note to show with it"
            : "Shown on your public page"}
        {page.on ? null : " (it's off for now)"}.
      </span>
      <button
        type="submit"
        name="intent"
        value={hidden ? "showOnPage" : "hideFromPage"}
        className={link}
      >
        {hidden ? "Show it" : "Keep it off"}
      </button>
      {full && !hidden ? <FullNote className={link} after /> : null}
      {fetcher.data?.pinError ? (
        <span role="alert" className="text-red-700 dark:text-red-400">
          {fetcher.data.pinError}
        </span>
      ) : null}
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
  page,
}: {
  notes: ReaderNote[];
  myNote: ReaderNote | null;
  canNote: boolean;
  maxLength: number;
  friendIds: string[];
  // When you read it, for readers of this copy
  readAt?: string | null;
  // For the owner: where it stands on their public page
  page?: PageStanding | null;
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
  const hasNotes = notes.some((note) => note.body);
  // Other readers who left a heart but no words
  const heartsOnly = notes.filter(
    (note) => note.loved && !note.body && note.id !== myNote?.id,
  );

  return (
    <div className="mt-12 border-t border-stone-200 dark:border-stone-800 pt-8">
      <h2
        id="notes"
        className={`${sectionHeading} mb-3`}
      >
        Reader notes
      </h2>
      {/* Hearts first: yours to give, and who else gave one without a note
          (people who wrote one show it on their note below) */}
      {canNote || heartsOnly.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {canNote ? <HeartToggle myNote={myNote} /> : null}
          {canNote && readAt !== undefined ? (
            <ReadToggle readAt={readAt} />
          ) : null}
          {page ? <PinToggle page={page} /> : null}
          {canNote && !myNote?.body && !isWriting ? (
            <button
              type="button"
              onClick={() => setIsWriting(true)}
              className={chip(false)}
            >
              <PencilIcon size={14} />
              {hasNotes ? "Add a note" : "Leave a note"}
            </button>
          ) : null}
          {heartsOnly.length > 0 ? (
            <p className="inline-flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400">
              {canNote ? null : (
                <HeartIcon size={13} filled className="text-rose-400" />
              )}
              {loved || hasNotes ? "Also loved by " : "Loved by "}
              {heartsOnly.map((note, index) => (
                <span key={note.id}>
                  {index > 0
                    ? index === heartsOnly.length - 1
                      ? " and "
                      : ", "
                    : null}
                  <PersonLink
                    id={note.user.id}
                    name={note.user.firstname}
                    friendIds={friendIds}
                  />
                </span>
              ))}
            </p>
          ) : null}
        </div>
      ) : null}
      {page ? <PageLine page={page} /> : null}

      {isWriting ? (
        <noteFetcher.Form method="post" className="py-3">
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
            className="w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 leading-relaxed text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10"
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
          {notes
            .filter((note) => note.body)
            .map((note) => {
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
                        <HeartIcon size={13} filled className="text-rose-400" />
                      ) : null}
                      <span className="text-stone-400 dark:text-stone-500">
                        {" "}
                        ·{" "}
                      </span>
                      <span className="text-sm text-stone-400 dark:text-stone-500">
                        {formatDate(note.updatedAt)}
                      </span>
                    </p>
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
        </ul>
      ) : !canNote && heartsOnly.length === 0 ? (
        <p className="py-2 text-sm text-stone-400 dark:text-stone-500">
          No notes yet.
        </p>
      ) : null}
    </div>
  );
}
