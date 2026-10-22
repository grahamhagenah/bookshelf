import { useFetcher } from "@remix-run/react";
import { useEffect, useState } from "react";

import Avatar from "./avatar";
import { HeartIcon } from "./icons";
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

// The heart sits under the cover and the notes further down; both read
// the same fetcher so a tap shows up in both places straight away
const LOVE_FETCHER = "reader-love";

function useLoved(notes: ReaderNote[], myNote: ReaderNote | null) {
  const fetcher = useFetcher({ key: LOVE_FETCHER });
  // Show the heart's new state straight away, before the server answers
  const pendingLoved = fetcher.formData?.get("loved");
  const loved =
    pendingLoved !== undefined && pendingLoved !== null
      ? pendingLoved === "true"
      : (myNote?.loved ?? false);
  // Everyone else who loved it, by first name
  const others = notes
    .filter((note) => note.loved && note.id !== myNote?.id)
    .map((note) => note.user.firstname);
  return { fetcher, loved, others };
}

// "Loved by you", "Loved by you and Maya", "Loved by Maya and 2 others"
function lovedBy(loved: boolean, others: string[]) {
  const names = loved ? ["you", ...others] : others;
  if (names.length === 0) return null;
  if (names.length === 1) return `Loved by ${names[0]}`;
  if (names.length === 2) return `Loved by ${names[0]} and ${names[1]}`;
  const rest = names.length - 1;
  return `Loved by ${names[0]} and ${rest} ${rest === 1 ? "other" : "others"}`;
}

export function LoveButton({
  notes,
  myNote,
  canNote,
}: {
  notes: ReaderNote[];
  myNote: ReaderNote | null;
  canNote: boolean;
}) {
  const { fetcher, loved, others } = useLoved(notes, myNote);
  const label = lovedBy(loved, others);

  if (!canNote) {
    return label ? (
      <p className="inline-flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400">
        <HeartIcon size={14} filled className="text-rose-400" />
        {label}
      </p>
    ) : null;
  }

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="toggleLove" />
      <input type="hidden" name="loved" value={loved ? "false" : "true"} />
      <button
        type="submit"
        aria-pressed={loved}
        title={loved ? "Take back your heart" : "Love it"}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
          loved
            ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            : "border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-stone-400 dark:hover:border-stone-500"
        }`}
      >
        <HeartIcon size={14} filled={loved} className={loved ? "text-rose-500" : ""} />
        {label ?? "Love it"}
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
  status,
}: {
  notes: ReaderNote[];
  myNote: ReaderNote | null;
  canNote: boolean;
  maxLength: number;
  friendIds: string[];
  // A line about your own reading of it, for the owner
  status?: React.ReactNode;
}) {
  const { loved } = useLoved(notes, myNote);
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
      <h2 id="notes" className="mb-2 text-lg font-semibold text-stone-900 dark:text-stone-100">
        Reader notes
      </h2>
      {status ? (
        <p className="mb-3 text-stone-600 dark:text-stone-300">{status}</p>
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
      ) : canNote && !myNote?.body ? (
        <p className="py-2 text-stone-400 dark:text-stone-500">
          {hasNotes ? null : "No notes yet. "}
          <button
            type="button"
            onClick={() => setIsWriting(true)}
            className="text-stone-600 dark:text-stone-300 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-900 dark:hover:text-stone-100"
          >
            {hasNotes ? "Add your note" : "Leave a line for the next reader"}
          </button>
        </p>
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

      {heartsOnly.length > 0 ? (
        <p className="py-2 text-sm text-stone-400 dark:text-stone-500">
          {hasNotes ? "Also loved by " : "Loved by "}
          {heartsOnly.map((note, index) => (
            <span key={note.id}>
              {index > 0 ? ", " : null}
              <PersonLink
                id={note.user.id}
                name={`${note.user.firstname} ${note.user.surname}`}
                friendIds={friendIds}
              />
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
