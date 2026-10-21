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

// Hearts and short notes left by the owner and everyone who has read this copy
export default function ReaderNotes({
  notes,
  myNote,
  canNote,
  maxLength,
  friendIds,
}: {
  notes: ReaderNote[];
  myNote: ReaderNote | null;
  canNote: boolean;
  maxLength: number;
  friendIds: string[];
}) {
  const loveFetcher = useFetcher();
  const noteFetcher = useFetcher<{ noteSaved?: boolean }>();
  const [isWriting, setIsWriting] = useState(false);

  // Show the heart's new state straight away, before the server answers
  const pendingLoved = loveFetcher.formData?.get("loved");
  const loved =
    pendingLoved !== undefined && pendingLoved !== null
      ? pendingLoved === "true"
      : (myNote?.loved ?? false);
  const loveCount =
    notes.filter((note) => note.loved).length -
    (myNote?.loved ? 1 : 0) +
    (loved ? 1 : 0);

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
    <div className="mt-10">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400">
          Reader notes
        </h2>
        {canNote ? (
          <loveFetcher.Form method="post">
            <input type="hidden" name="intent" value="toggleLove" />
            <input type="hidden" name="loved" value={loved ? "false" : "true"} />
            <button
              type="submit"
              aria-pressed={loved}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                loved
                  ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900"
                  : "border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-stone-400 dark:hover:border-stone-500"
              }`}
            >
              <HeartIcon size={14} filled={loved} />
              {loved ? "Loved" : "Love it"}
              {loveCount > 0 ? (
                <span className={loved ? "opacity-70" : "text-stone-400"}>
                  {loveCount}
                </span>
              ) : null}
            </button>
          </loveFetcher.Form>
        ) : loveCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-sm text-stone-500 dark:text-stone-400">
            <HeartIcon size={14} filled />
            {loveCount}
          </span>
        ) : null}
      </div>

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
            className="w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm leading-relaxed text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            required
          />
          <div className="mt-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={isSaving}
              className={`rounded-md bg-stone-900 dark:bg-stone-100 px-3 py-1.5 text-sm font-medium text-white dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-300 transition-colors ${isSaving ? "opacity-60 cursor-wait" : ""}`}
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
        <p className="py-2 text-sm text-stone-400 dark:text-stone-500">
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
        <ul className="divide-y divide-stone-100 dark:divide-stone-800">
          {notes
            .filter((note) => note.body)
            .map((note) => {
              const isMine = note.id === myNote?.id;
              if (isMine && isWriting) return null;
              return (
                <li key={note.id} className="flex gap-3 py-3">
                  <Avatar
                    firstname={note.user.firstname}
                    surname={note.user.surname}
                    icon={note.user.profileEmoji}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm">
                      <span className="font-medium text-stone-900 dark:text-stone-100">
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
                      {(isMine ? loved : note.loved) ? (
                        <HeartIcon
                          size={12}
                          filled
                          className="text-stone-500 dark:text-stone-400"
                        />
                      ) : null}
                      <span className="text-xs text-stone-400 dark:text-stone-500">
                        {formatDate(note.updatedAt)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-sm leading-relaxed text-stone-700 dark:text-stone-300 whitespace-pre-wrap break-words">
                      {note.body}
                    </p>
                    {isMine ? (
                      <div className="mt-1 flex gap-3 text-xs">
                        <button
                          type="button"
                          onClick={() => setIsWriting(true)}
                          className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                        >
                          Edit
                        </button>
                        <noteFetcher.Form method="post">
                          <input type="hidden" name="intent" value="deleteNote" />
                          <button
                            type="submit"
                            className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                          >
                            Remove
                          </button>
                        </noteFetcher.Form>
                      </div>
                    ) : null}
                  </div>
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
        <p className="py-2 text-xs text-stone-400 dark:text-stone-500">
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
