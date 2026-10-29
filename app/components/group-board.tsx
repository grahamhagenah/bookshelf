import { useEffect, useState } from "react";
import { Link, useFetcher } from "react-router";

import type { getGroupBoard } from "~/models/group-board.server";
import type { SuggestResponse } from "~/routes/api.search-suggest";
import type { LoaderData } from "~/utils";
import { workPath } from "~/utils";

import Avatar from "./avatar";
import BookCover from "./book-cover";
import { quietButton, textField } from "./ui";

type Board = NonNullable<LoaderData<Awaited<ReturnType<typeof getGroupBoard>>>>;
type Editing = "pick" | "meeting" | "chat" | null;

// Side by side from small screens, as many as there are parts: the book,
// its copies, the meetup, the chat
const COLUMNS: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)]",
};

// A meetup's time as it was typed, the same for everyone: "Thu, Nov 13 ·
// 7pm" (a time of day only when one was given)
export function meetingWhen(at: string | Date) {
  const date = new Date(at);
  const day = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  if (date.getUTCHours() === 0 && date.getUTCMinutes() === 0) return day;
  const time = date
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })
    .replace(":00", "")
    .replace(" ", "")
    .toLowerCase();
  return `${day} · ${time}`;
}

// Over once its day is: a meetup keeps the time it was typed with, so
// it counts as past only after that whole day, wherever you are
export const meetingPast = (at: string | Date | null) =>
  at !== null && new Date(at).getTime() + 24 * 60 * 60 * 1000 < Date.now();

const shortDate = (at: string | Date) =>
  new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// What a group can keep here if it plans here: the book it's reading, when
// and where it meets, and its group chat. None of it is needed; a group
// that plans in its chat sees only a quiet row of ways to add them. Any
// member can change any of it, and the card says who did last.
export default function GroupBoard({
  board,
  path,
  groupName,
  userId,
}: {
  board: Board | null;
  path: string;
  groupName: string;
  userId: string;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const pick = board?.pick ?? null;
  const meeting = board?.meeting ?? null;
  const chat = board?.chat ?? null;
  const done = () => setEditing(null);
  const who = (person: { id: string; firstname: string } | null) =>
    person ? (person.id === userId ? "you" : person.firstname) : "someone";

  // The ways to add what isn't there yet
  const adders = (
    <>
      {!pick ? <Adder label="Pick a book" onClick={() => setEditing("pick")} /> : null}
      {!meeting ? <Adder label="Set a meetup" onClick={() => setEditing("meeting")} /> : null}
      {!chat ? <Adder label="Add group chat" onClick={() => setEditing("chat")} /> : null}
    </>
  );

  if (!pick && !meeting && !chat && !editing) {
    return (
      <div className="mb-6 flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-stone-500 dark:text-stone-400">
        <span className="mr-1">Planning here?</span>
        {adders}
      </div>
    );
  }

  const section = "min-w-0";
  const label = "text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500";

  return (
    <section
      aria-label={`${groupName}: what you're reading and when you meet`}
      className="mb-6 rounded-xl border border-stone-200 dark:border-stone-800"
    >
      {/* On phones the book and its copies take the width, and the meetup
          and chat share a row */}
      <div className={`grid grid-cols-2 gap-x-4 gap-y-5 p-4 ${COLUMNS[[pick, pick, meeting, chat].filter(Boolean).length] ?? "sm:grid-cols-1"}`}>
        {editing === "pick" ? (
          <div className="col-span-full">
            <PickSearch path={path} groupName={groupName} onDone={done} />
          </div>
        ) : editing === "meeting" ? (
          <div className="col-span-full">
            <MeetingForm path={path} meeting={meeting} onDone={done} />
          </div>
        ) : editing === "chat" ? (
          <div className="col-span-full">
            <ChatForm path={path} url={chat?.url ?? ""} onDone={done} />
          </div>
        ) : (
          <>
            {pick ? (
              <div className={`${section} col-span-2 sm:col-span-1`}>
                {/* The cover gets the card's height; its label sits over
                    the title beside it */}
                <div className="flex gap-4">
                  <PickLink pick={pick}>
                    <BookCover cover={pick.cover} title={pick.title} author={pick.author} className="h-[105px] w-[70px] flex-shrink-0" />
                  </PickLink>
                  <div className="min-w-0">
                    <p className={`${label} mb-1`}>Reading</p>
                    <PickLink pick={pick} className="font-semibold leading-snug text-stone-900 dark:text-stone-100 underline-offset-2 hover:underline">
                      {pick.title}
                    </PickLink>
                    <p className="text-sm text-stone-500 dark:text-stone-400">{pick.author}</p>
                    {pick.finished.length > 0 ? (
                      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                        {pick.finished.length} of {pick.memberCount} finished ·{" "}
                        {names(pick.finished.map((person) => who(person)))}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                      Picked by {who(pick.pickedBy)} ·{" "}
                      <button type="button" onClick={() => setEditing("pick")} className="underline-offset-2 hover:underline hover:text-stone-700 dark:hover:text-stone-300">
                        Change
                      </button>
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            {pick ? <CopiesColumn pick={pick} userId={userId} /> : null}
            {meeting ? (
              <div className={`${section} ${chat ? "" : "col-span-2"} sm:col-span-1`}>
                <p className={label}>{meetingPast(meeting.at) ? "Last meetup" : "Next meetup"}</p>
                {meeting.at ? (
                  <p className="mt-2 font-semibold text-stone-900 dark:text-stone-100">{meetingWhen(meeting.at)}</p>
                ) : null}
                {meeting.place ? (
                  <p className={`${meeting.at ? "" : "mt-2 "}text-sm text-stone-600 dark:text-stone-300`}>{meeting.place}</p>
                ) : null}
                <p className="mt-1 text-xs text-stone-400 dark:text-stone-500">
                  {meeting.at && !meetingPast(meeting.at) ? (
                    <>
                      {/* A file any calendar app opens: the date, the time
                          as typed, the place and the book */}
                      <a href={`${path}/meetup.ics`} download className="underline-offset-2 hover:underline hover:text-stone-700 dark:hover:text-stone-300">
                        Add to calendar
                      </a>
                      {" · "}
                    </>
                  ) : null}
                  <button type="button" onClick={() => setEditing("meeting")} className="underline-offset-2 hover:underline hover:text-stone-700 dark:hover:text-stone-300">
                    Change
                  </button>
                </p>
              </div>
            ) : null}
            {chat ? (
              <div className={`${section} ${meeting ? "" : "col-span-2"} sm:col-span-1`}>
                <p className={label}>Group chat</p>
                <a
                  href={chat.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${quietButton("md")} mt-2 inline-flex items-center gap-1.5 font-medium`}
                >
                  {chat.app ? `Join on ${chat.app}` : "Open the chat"}
                  <span aria-hidden="true" className="text-stone-400 dark:text-stone-500">
                    ↗
                  </span>
                </a>
                <button type="button" onClick={() => setEditing("chat")} className="mt-1 block text-xs text-stone-400 dark:text-stone-500 underline-offset-2 hover:underline hover:text-stone-700 dark:hover:text-stone-300">
                  Change
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
      {editing ? null : (
        <div className="flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-stone-100 dark:border-stone-800 px-4 py-2 text-sm text-stone-500 dark:text-stone-400">
          {adders}
          {board?.changed ? (
            <span className="ml-auto text-xs text-stone-400 dark:text-stone-500">
              Updated by {who(board.changed.by)} · {shortDate(board.changed.at)}
            </span>
          ) : null}
        </div>
      )}
    </section>
  );
}

// "Maya", "Maya and Sam", "Maya, Sam and you"
const names = (people: string[]) =>
  people.length <= 1
    ? people.join("")
    : `${people.slice(0, -1).join(", ")} and ${people[people.length - 1]}`;

// Everyone in the group with a copy of its book, each opening their shelf
// already looking for it (yours, or one you're borrowing, opens the copy),
// said plainly: "Maya has a copy", "Sam's copy is lent out"
function CopiesColumn({ pick, userId }: { pick: NonNullable<Board["pick"]>; userId: string }) {
  const name = (person: { firstname: string }) => (
    <span className="font-medium text-stone-800 dark:text-stone-200 underline-offset-4 decoration-stone-300 dark:decoration-stone-600 group-hover:underline">
      {person.firstname}
    </span>
  );
  const say = (copy: NonNullable<Board["pick"]>["copies"][number]) =>
    copy.mine ? (
      <>You have a copy</>
    ) : copy.borrowerId === userId ? (
      <>You&apos;re borrowing {name(copy.owner)}&apos;s</>
    ) : copy.requested ? (
      <>You asked {name(copy.owner)} for it</>
    ) : copy.notLending ? (
      <>{name(copy.owner)} has a copy, not lending now</>
    ) : copy.borrowerId ? (
      <>{name(copy.owner)}&apos;s copy is lent out</>
    ) : (
      <>{name(copy.owner)} has a copy</>
    );
  // Yours first, then the ones you could borrow now
  const rank = (copy: NonNullable<Board["pick"]>["copies"][number]) =>
    copy.mine || copy.borrowerId === userId ? 0 : copy.available ? 1 : 2;
  const sorted = [...pick.copies].sort((a, b) => rank(a) - rank(b));
  const copies = sorted.filter((copy) => copy.inGroup || copy.mine);
  // Friends outside the group with one, for when the group's are spoken for
  const outside = sorted.filter((copy) => !copy.inGroup && !copy.mine);
  const row = (copy: NonNullable<Board["pick"]>["copies"][number]) => (
    <li key={copy.bookId}>
      <Link
        to={
          copy.mine || copy.borrowerId === userId
            ? `/books/${copy.bookId}`
            : `/friend/${copy.owner.id}?${new URLSearchParams({ q: copy.title })}`
        }
        className="group flex items-center gap-2.5 py-1 text-sm text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white transition-colors"
      >
        <span className="rounded-full bg-white dark:bg-stone-950">
          <Avatar firstname={copy.owner.firstname} surname={copy.owner.surname} icon={copy.owner.profileEmoji} size="xs" />
        </span>
        <span className="min-w-0">{say(copy)}</span>
      </Link>
    </li>
  );
  return (
    <div className="col-span-2 min-w-0 sm:col-span-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Copies</p>
      {copies.length === 0 ? (
        <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">Nobody here has one yet</p>
      ) : (
        <ul className="mt-1">{copies.map(row)}</ul>
      )}
      {outside.length > 0 ? (
        <>
          <p className="mt-3 text-xs text-stone-400 dark:text-stone-500">Friends outside the group</p>
          <ul className="mt-0.5">{outside.slice(0, 3).map(row)}</ul>
        </>
      ) : null}
    </div>
  );
}

function Adder({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm text-stone-500 dark:text-stone-400 hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-stone-800 dark:hover:text-stone-100 transition-colors"
    >
      <span aria-hidden="true">+</span>
      {label}
    </button>
  );
}

// The book's own page when Open Library knows it, a search when it doesn't
function PickLink({
  pick,
  className,
  children,
}: {
  pick: NonNullable<Board["pick"]>;
  className?: string;
  children: React.ReactNode;
}) {
  const to = workPath(pick.key) ?? `/search?${new URLSearchParams({ q: `${pick.title} ${pick.author}`.trim() })}`;
  return (
    <Link to={to} className={className}>
      {children}
    </Link>
  );
}

const cancelClass =
  "text-sm text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200";

// Finding the group's next book on Open Library, picked in one tap
function PickSearch({ path, groupName, onDone }: { path: string; groupName: string; onDone: () => void }) {
  const [query, setQuery] = useState("");
  const suggest = useFetcher<SuggestResponse>();
  const pick = useFetcher();
  const clear = useFetcher();
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const timer = setTimeout(() => suggest.load(`/api/search-suggest?q=${encodeURIComponent(q)}&source=openLibrary`), 250);
    return () => clearTimeout(timer);
    // suggest.load is stable enough; depending on the fetcher would loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);
  // Back to the card once the pick is saved
  useEffect(() => {
    if (pick.state === "idle" && pick.data) onDone();
  }, [pick.state, pick.data, onDone]);
  const results = query.trim().length >= 2 ? (suggest.data?.openLibrary ?? []).slice(0, 5) : [];

  return (
    <div>
      <div className="flex items-center gap-2">
        <label htmlFor="pick-search" className="sr-only">
          Find a book for {groupName}
        </label>
        <input
          id="pick-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          placeholder={`A book for ${groupName}`}
          className={`${textField} h-9 min-w-0 flex-1 py-0 text-sm`}
        />
        <button type="button" onClick={onDone} className={cancelClass}>
          Cancel
        </button>
      </div>
      {results.length > 0 ? (
        <ul className="mt-2 divide-y divide-stone-100 dark:divide-stone-800">
          {results.map((book) => (
            <li key={book.key ?? book.title} className="flex items-center gap-3 py-2">
              <BookCover
                cover={book.coverId ? `https://covers.openlibrary.org/b/id/${book.coverId}-M.jpg` : null}
                title={book.title}
                author={book.author ?? ""}
                compact
                className="h-12 w-8 flex-shrink-0"
              />
              <span className="min-w-0 flex-1 text-sm">
                <span className="block truncate font-medium text-stone-900 dark:text-stone-100">{book.title}</span>
                <span className="block truncate text-stone-500 dark:text-stone-400">{book.author}</span>
              </span>
              <pick.Form method="post" action={path} className="flex-shrink-0">
                <input type="hidden" name="intent" value="pick" />
                <input type="hidden" name="key" value={book.key ?? ""} />
                <input type="hidden" name="title" value={book.title} />
                <input type="hidden" name="author" value={book.author ?? ""} />
                <input type="hidden" name="cover" value={book.coverId ? `https://covers.openlibrary.org/b/id/${book.coverId}-L.jpg` : ""} />
                <button type="submit" disabled={pick.state !== "idle"} className={`${quietButton("sm")} font-medium`}>
                  Pick
                </button>
              </pick.Form>
            </li>
          ))}
        </ul>
      ) : query.trim().length >= 2 ? (
        <p className="mt-2 text-sm text-stone-400 dark:text-stone-500">{suggest.state !== "idle" ? "Looking…" : "Nothing found yet"}</p>
      ) : null}
      <clear.Form method="post" action={path} className="mt-2" onSubmit={onDone}>
        <input type="hidden" name="intent" value="clearPick" />
        <button type="submit" className="text-xs text-stone-400 dark:text-stone-500 underline-offset-2 hover:underline hover:text-stone-700 dark:hover:text-stone-300">
          No book for now
        </button>
      </clear.Form>
    </div>
  );
}

// "2026-11-13T19:00", as the date and time boxes want it, from a meetup
// kept as it was typed
const asTyped = (at: string | Date | null) => (at ? new Date(at).toISOString().slice(0, 16) : "");

function MeetingForm({
  path,
  meeting,
  onDone,
}: {
  path: string;
  meeting: Board["meeting"];
  onDone: () => void;
}) {
  const fetcher = useFetcher();
  const at = asTyped(meeting?.at ?? null);
  return (
    <fetcher.Form method="post" action={path} onSubmit={onDone} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="intent" value="meeting" />
      <label className="text-sm text-stone-600 dark:text-stone-300">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">When</span>
        <span className="flex gap-2">
          <input type="date" name="date" defaultValue={at.slice(0, 10)} className={`${textField} h-9 w-auto py-0 text-sm`} />
          <input type="time" name="time" defaultValue={at && at.slice(11) !== "00:00" ? at.slice(11) : ""} aria-label="Time" className={`${textField} h-9 w-auto py-0 text-sm`} />
        </span>
      </label>
      <label className="min-w-48 flex-1 text-sm text-stone-600 dark:text-stone-300">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">Where</span>
        <input
          type="text"
          name="place"
          maxLength={120}
          defaultValue={meeting?.place ?? ""}
          placeholder="Sam's place, the library, a video call…"
          className={`${textField} h-9 py-0 text-sm`}
        />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className={quietButton("md")}>
          Save
        </button>
        {meeting ? (
          <button type="submit" name="clear" value="1" className={cancelClass}>
            Remove
          </button>
        ) : null}
        <button type="button" onClick={onDone} className={cancelClass}>
          Cancel
        </button>
      </div>
    </fetcher.Form>
  );
}

function ChatForm({ path, url, onDone }: { path: string; url: string; onDone: () => void }) {
  const fetcher = useFetcher();
  return (
    <fetcher.Form method="post" action={path} onSubmit={onDone} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="intent" value="chat" />
      <label className="min-w-64 flex-1 text-sm text-stone-600 dark:text-stone-300">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-stone-400 dark:text-stone-500">
          Invite link to your group chat
        </span>
        <input
          // Text, so a link pasted without https:// is taken too
          type="text"
          inputMode="url"
          autoCapitalize="off"
          spellCheck={false}
          name="url"
          maxLength={300}
          defaultValue={url}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          placeholder="https://chat.whatsapp.com/…"
          className={`${textField} h-9 py-0 text-sm`}
        />
        <span className="mt-1 block text-xs text-stone-400 dark:text-stone-500">Only people in the group see it.</span>
      </label>
      <div className="flex items-center gap-3 pb-5">
        <button type="submit" className={quietButton("md")}>
          Save
        </button>
        {url ? (
          <button type="submit" name="clear" value="1" className={cancelClass}>
            Remove
          </button>
        ) : null}
        <button type="button" onClick={onDone} className={cancelClass}>
          Cancel
        </button>
      </div>
    </fetcher.Form>
  );
}
