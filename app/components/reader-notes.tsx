import { useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";

import Avatar from "./avatar";
import { CheckIcon, HeartIcon, PencilIcon } from "./icons";
import PersonLink from "./person-link";

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
    on || "border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-stone-400 dark:hover:border-stone-500"
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
        <HeartIcon size={14} filled={loved} className={loved ? "text-rose-500" : ""} />
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
        title={read ? "Mark as not read. Only you see this." : "Only you see this"}
        className={chip(
          read &&
            "border-forest-600/25 bg-forest-600/10 text-forest-700 dark:border-forest-400/30 dark:bg-forest-400/15 dark:text-forest-400",
        )}
      >
        {/* Both labels share one cell, centered, so the button keeps its
            width and the row doesn't shift. No date: when you marked it
            isn't always when you read it */}
        <span className="grid justify-items-center">
          <span className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 ${read ? "invisible" : ""}`}>
            <CheckIcon size={14} />
            Mark as read
          </span>
          <span className={`col-start-1 row-start-1 inline-flex items-center gap-1.5 ${read ? "" : "invisible"}`}>
            <CheckIcon size={14} />
            Read
          </span>
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
}: {
  notes: ReaderNote[];
  myNote: ReaderNote | null;
  canNote: boolean;
  maxLength: number;
  friendIds: string[];
  // When you read it, for readers of this copy
  readAt?: string | null;
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
      <h2 id="notes" className="mb-3 text-lg font-semibold text-stone-900 dark:text-stone-100">
        Reader notes
      </h2>
      {/* Hearts first: yours to give, and who else gave one without a note
          (people who wrote one show it on their note below) */}
      {canNote || heartsOnly.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {canNote ? <HeartToggle myNote={myNote} /> : null}
          {canNote && readAt !== undefined ? <ReadToggle readAt={readAt} /> : null}
          {canNote && !myNote?.body && !isWriting ? (
            <button type="button" onClick={() => setIsWriting(true)} className={chip(false)}>
              <PencilIcon size={14} />
              {hasNotes ? "Add a note" : "Leave a note"}
            </button>
          ) : null}
          {heartsOnly.length > 0 ? (
            <p className="inline-flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400">
              {canNote ? null : <HeartIcon size={13} filled className="text-rose-400" />}
              {loved || hasNotes ? "Also loved by " : "Loved by "}
              {heartsOnly.map((note, index) => (
                <span key={note.id}>
                  {index > 0 ? (index === heartsOnly.length - 1 ? " and " : ", ") : null}
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
                        {(isMine ? loved : note.loved) ? "loved it" : "wrote about it"}
                      </span>
                      {(isMine ? loved : note.loved) ? (
                        <HeartIcon size={13} filled className="text-rose-400" />
                      ) : null}
                      <span className="text-stone-400 dark:text-stone-500"> · </span>
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
