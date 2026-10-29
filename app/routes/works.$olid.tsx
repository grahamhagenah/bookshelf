
import { useState } from "react";
import { data, Form, Link, useFetcher, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

import BookCover from "~/components/book-cover";
import ErrorPage from "~/components/error-page";
import { BookmarkIcon, CheckCircleIcon } from "~/components/icons";
import OpeningLine from "~/components/opening-line";
import PersonLink from "~/components/person-link";
import ReaderNotes from "~/components/reader-notes";
import SubjectTags from "~/components/subject-tags";
import { primaryButton, quietButton } from "~/components/ui";
import { groupPath } from "~/group-links";
import { isNotLending } from "~/lending";
import {
  createBook,
  findOwnCopy,
  searchFriendsBooks,
} from "~/models/book.server";
import { circleOf } from "~/models/circle.server";
import { groupsToPick } from "~/models/group-pick.server";
import { shelfIds } from "~/models/household.server";
import { NOTE_MAX_LENGTH } from "~/models/note.server";
import {
  PATIENT_MS,
  lookupWork,
  lookupWorkPage,
} from "~/models/openlibrary.server";
import { withSharedCover } from "~/models/shared-cover.server";
import {
  addWantToRead,
  isOnWantToRead,
  notifyWanters,
  removeWantedWork,
} from "~/models/wish.server";
import {
  getMyWorkNote,
  getWorkNotes,
  getWorkSnapshot,
  saveWorkNote,
} from "~/models/work-note.server";
import { LIMIT_MESSAGES, UPGRADE_PATH } from "~/plan";
import { roomForBooks } from "~/plan.server";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";
import { cleanSubjects, stripMarkdown } from "~/utils";
import { sameWork } from "~/works";

// A book that isn't on anyone's shelf yet, straight from Open Library:
// what a search result opens into. The same two choices as the result
// (add it, or want it), plus any friend's copy to borrow instead.

// Open Library work ids look like OL45804W
const OLID = /^OL\d+W$/;

const quietLink =
  "text-stone-500 dark:text-stone-400 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-800 dark:hover:text-stone-200";

export const meta: MetaFunction<typeof loader> = ({ loaderData }) =>
  seo({
    title: loaderData?.work ? `${loaderData.work.title} by ${loaderData.work.author}` : "Book",
    noindex: true,
  });

// The trail goes back the way you most likely came: from your shelf, your
// Want to read or Also read list when the book's on one, else from search
export const handle = {
  breadcrumbs: (
    data:
      | {
          work?: { title: string };
          ownCopyId?: string | null;
          wanted?: boolean;
          myNote?: { loved: boolean; body: string | null; readAt: unknown } | null;
        }
      | undefined,
  ) => {
    const myShelf = { label: "My shelf", href: "/books" };
    const from = data?.ownCopyId
      ? [myShelf]
      : data?.wanted
        ? // The tab is short beside the others; a trail says it in full
          [myShelf, { label: "Want to read", href: "/want-to-read" }]
        : data?.myNote && (data.myNote.loved || data.myNote.body || data.myNote.readAt)
          ? [myShelf, { label: "Also read", href: "/read-elsewhere" }]
          : [{ label: "Search", href: "/search" }];
    return [...from, { label: data?.work?.title ?? "Book" }];
  },
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const olid = params.olid ?? "";
  if (!OLID.test(olid)) throw new Response("Not Found", { status: 404 });
  const key = `/works/${olid}`;

  // Open Library is slow some days: a book someone has already noted
  // still opens, from what was saved of it
  let offline = false;
  let work = await lookupWorkPage(key).catch(() => undefined);
  if (!work) {
    const saved = await getWorkSnapshot(key);
    if (!saved) {
      throw work === undefined
        ? new Response("Open Library didn't answer", { status: 503 })
        : new Response("Not Found", { status: 404 });
    }
    offline = true;
    work = {
      key,
      title: saved.title,
      author: saved.author,
      cover: saved.cover,
      datePublished: null,
      pageCount: null,
      subjects: null,
      publisher: null,
      firstSentence: null,
      authorKey: null,
      isbn: null,
      description: "",
      authorDetails: null,
    };
  }
  // A cover someone picked for it, over Open Library's
  work = { ...work, cover: await withSharedCover(work.cover, { openLibraryKey: key }) };

  const [ownCopy, wanted, matches, myNote, notes, groups] = await Promise.all([
    findOwnCopy(await shelfIds(userId), {
      title: work.title ?? "",
      openLibraryKey: key,
    }),
    isOnWantToRead(userId, { title: work.title ?? "", openLibraryKey: key }),
    searchFriendsBooks(userId, work.title ?? ""),
    getMyWorkNote(userId, key),
    getWorkNotes(userId, key),
    groupsToPick(userId, { key, title: work.title ?? "" }),
  ]);
  // Friends' copies of this book, not just ones with a similar title
  const friendCopies = matches.filter((book) =>
    sameWork(
      { title: book.title, openLibraryKey: null },
      { title: work.title ?? "", openLibraryKey: null },
    ),
  );

  return data({
    work,
    ownCopyId: ownCopy?.id ?? null,
    wanted,
    friendCopies,
    // Your groups, to make this their pick
    groups,
    // Whose names open their shelf: friends and group-mates
    friendIds: (await circleOf(userId)).ids,
    offline,
    // Hearts and notes from you and your friends; your read mark is yours
    myNote,
    notes,
    noteMaxLength: NOTE_MAX_LENGTH,
  });
};

const NOTE_INTENTS = new Set([
  "toggleLove",
  "toggleRead",
  "saveNote",
  "deleteNote",
]);

// The same work as the search page's buttons, for this one book
export const action = async ({ params, request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  const olid = params.olid ?? "";
  if (!OLID.test(olid)) throw new Response("Not Found", { status: 404 });
  const key = `/works/${olid}`;
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  // Off your Want to read list. Matched by the work, or the title it was put
  // on the list with, so Open Library needn't be asked
  if (intent === "unwant") {
    await removeWantedWork(userId, {
      title: String(form.get("title") ?? ""),
      openLibraryKey: key,
    });
    return data({ success: true, wanted: false });
  }

  // A heart, read mark or note on a book read somewhere else. What it's
  // saved with comes from an earlier note when there is one, so Open
  // Library is asked only the first time.
  if (NOTE_INTENTS.has(intent)) {
    let snapshot = await getWorkSnapshot(key);
    if (!snapshot) {
      const found = await lookupWork(
        { title: "", author: "", openLibraryKey: key },
        PATIENT_MS,
      ).catch(() => null);
      if (!found?.title)
        throw new Response("Open Library didn't answer", { status: 503 });
      snapshot = {
        title: found.title,
        author: found.author ?? "",
        cover: found.cover ?? "",
      };
    }
    const body = form.get("body");
    await saveWorkNote(
      userId,
      { key, ...snapshot },
      intent === "toggleLove"
        ? { loved: form.get("loved") === "true" }
        : intent === "toggleRead"
          ? { read: form.get("read") === "true" }
          : {
              body:
                intent === "saveNote" && typeof body === "string" ? body : null,
            },
      // Rewritten from the feed: it keeps its place there
      { keepTime: form.get("edit") === "true" },
    );
    return data(
      intent === "saveNote" || intent === "deleteNote"
        ? { noteSaved: true }
        : { ok: true },
    );
  }

  const work = await lookupWorkPage(key).catch(() => {
    throw new Response("Open Library didn't answer", { status: 503 });
  });
  if (!work || !work.title) throw new Response("Not Found", { status: 404 });

  if (intent === "want") {
    await addWantToRead(userId, {
      title: work.title,
      author: work.author ?? "",
      cover: work.cover ?? "",
      openLibraryKey: key,
    });
    return data({ success: true, wanted: true });
  }

  const ownCopy = await findOwnCopy(await shelfIds(userId), {
    title: work.title,
    openLibraryKey: key,
  });
  if (ownCopy)
    return data({ success: false, alreadyExists: true, ownCopyId: ownCopy.id });
  if ((await roomForBooks(userId)) < 1) {
    return data(
      { success: false, limit: LIMIT_MESSAGES.books },
      { status: 403 },
    );
  }
  const book = await createBook({
    title: work.title,
    author: work.author ?? "",
    body: work.description,
    cover: work.cover ?? "",
    datePublished: work.datePublished,
    pageCount: work.pageCount,
    subjects: work.subjects,
    publisher: work.publisher,
    openLibraryKey: key,
    userId,
  });
  await notifyWanters(userId, [book]);
  return data({ success: true, added: book.id });
};

export default function WorkPage() {
  const data = useLoaderData<typeof loader>();
  const { work } = data;
  const fetcher = useFetcher<{
    success: boolean;
    wanted?: boolean;
    alreadyExists?: boolean;
    ownCopyId?: string;
    added?: string;
    limit?: string;
  }>();
  const intent = fetcher.formData?.get("intent");
  const adding = fetcher.state !== "idle" && intent !== "want" && intent !== "unwant";
  const wanting = fetcher.state !== "idle" && intent === "want";
  const added = fetcher.data?.added;
  const ownCopyId = data.ownCopyId ?? fetcher.data?.ownCopyId ?? null;
  const inLibrary = ownCopyId !== null;
  // What the last want or unwant said, until the page's own data catches up
  const wanted =
    fetcher.state !== "idle" && intent === "unwant"
      ? false
      : typeof fetcher.data?.wanted === "boolean"
        ? fetcher.data.wanted
        : data.wanted;
  const subjects = cleanSubjects(work.subjects);
  // One quiet line: the year and the length. What it's about goes in tags
  // under the author; no publisher, since up by the title it crowded the
  // heading.
  const details = [
    work.datePublished,
    work.pageCount ? `${work.pageCount} pages` : null,
  ].filter(Boolean);

  const heading = (
    <>
      <h1 className="text-2xl md:text-4xl font-semibold tracking-tight leading-tight text-stone-900 dark:text-stone-100">
        {work.title}
      </h1>
      <p className="mt-1 md:text-xl text-stone-500 dark:text-stone-400">
        {/* More by them, from Open Library */}
        {work.author ? (
          <Link
            to={`/search?${new URLSearchParams({ q: work.author, type: "author" })}`}
            title={`More books by ${work.author}`}
            className="underline-offset-4 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-800 dark:hover:text-stone-200 hover:underline"
          >
            {work.author}
          </Link>
        ) : null}
      </p>
      {details.length > 0 ? (
        <p className="mt-3 md:mt-4 text-[15px] md:text-base text-stone-500 dark:text-stone-400">
          {details.join(" · ")}
        </p>
      ) : null}
    </>
  );

  return (
    <main className="flex w-full flex-col gap-6 px-4 py-8 md:flex-row md:gap-12 lg:gap-16 xl:gap-20 md:px-8 md:py-12">
      <section className="flex-shrink-0 space-y-4 md:w-[200px] lg:w-[240px]">
        <div className="flex items-start gap-4">
          <BookCover
            cover={work.cover}
            size="L"
            title={work.title ?? ""}
            author={work.author}
            alt={work.title ?? ""}
            eager
            className="w-[120px] flex-shrink-0 aspect-[2/3] shadow-sm md:w-[200px] lg:w-[240px]"
          />
          <div className="min-w-0 flex-1 [overflow-wrap:anywhere] md:hidden">
            {heading}
          </div>
        </div>

        {/* The two choices from the search result, for this book */}
        <fetcher.Form method="post" className="flex flex-col gap-2">
          {added || inLibrary ? (
            // Just added: back to the library, where it sits with the rest.
            // Opening the new copy would look like nothing happened.
            <Link
              to={added ? "/books" : `/books/${ownCopyId}`}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-stone-100 dark:bg-stone-800 px-4 py-2 text-sm text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors"
            >
              <CheckCircleIcon size={14} />
              {added ? "Added. See it on my shelf" : "On your shelf. Open it"}
            </Link>
          ) : (
            <button
              type="submit"
              disabled={adding}
              className={`${primaryButton("lg")} w-full disabled:opacity-60`}
            >
              {adding ? "Adding…" : "Add to my shelf"}
            </button>
          )}
          {/* Want to read, as a toggle: pressed while it's on your list,
              and pressing it again takes it off */}
          {added || inLibrary ? null : (
            <button
              type="submit"
              name="intent"
              value={wanted ? "unwant" : "want"}
              aria-pressed={wanted}
              title={wanted ? "Take it off your Want to read list" : undefined}
              disabled={wanting}
              className={`${quietButton("lg")} inline-flex w-full items-center justify-center gap-1.5 disabled:opacity-60 ${
                wanted ? "border-transparent bg-stone-100 dark:border-transparent dark:bg-stone-800" : ""
              }`}
            >
              <BookmarkIcon size={14} filled={wanted} />
              {wanting ? "Saving…" : wanted ? "On your list" : "Want to read"}
            </button>
          )}
          {/* Matched by the title it went on the list with, when taken off */}
          {wanted ? <input type="hidden" name="title" value={work.title ?? ""} /> : null}
          {fetcher.data?.limit ? (
            <p className="text-sm text-stone-600 dark:text-stone-300">
              {fetcher.data.limit}{" "}
              <Link
                to={UPGRADE_PATH}
                className="font-medium text-forest-700 dark:text-forest-400 underline underline-offset-2"
              >
                See Stacks Plus
              </Link>
            </p>
          ) : null}
        </fetcher.Form>
        {/* Just added, but meant for the list: undone in one tap */}
        {added ? (
          <Form method="post" action={`/books/${added}`} className="-mt-2 text-center">
            <input type="hidden" name="intent" value="moveToWant" />
            <button
              type="submit"
              className="-my-2 py-2 text-xs text-stone-500 dark:text-stone-400 underline-offset-2 hover:underline hover:text-stone-800 dark:hover:text-stone-200"
            >
              Meant Want to read? Move it there
            </button>
          </Form>
        ) : null}

        {/* What your group reads next */}
        {data.groups.length > 0 ? (
          <PickForGroup
            groups={data.groups}
            work={{ key: work.key, title: work.title ?? "", author: work.author ?? "", cover: work.cover ?? "" }}
          />
        ) : null}

        {/* Borrow it instead: a friend already has a copy */}
        {data.friendCopies.length > 0 ? (
          <div className="rounded-md border border-stone-200 dark:border-stone-700 p-3 text-sm">
            <p className="font-medium text-stone-800 dark:text-stone-200">
              {data.friendCopies.length === 1
                ? "A friend has it"
                : "Friends have it"}
            </p>
            <ul className="mt-1.5 space-y-1">
              {data.friendCopies.map((copy) => (
                <li
                  key={copy.id}
                  className="flex items-center justify-between gap-2"
                >
                  <PersonLink
                    id={copy.user.id}
                    name={`${copy.user.firstname} ${copy.user.surname}`}
                    friendIds={data.friendIds}
                  />
                  <Link
                    to={`/books/${copy.id}`}
                    className="text-stone-500 dark:text-stone-400 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-900 dark:hover:text-stone-100"
                  >
                    {copy.borrowerId
                      ? "Lent out"
                      : isNotLending(copy.notLendingUntil)
                        ? "Not lending"
                        : "Ask to borrow"}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="relative min-w-0 flex-1">
        <div className="hidden md:block">{heading}</div>

        {work.firstSentence ? (
          <OpeningLine sentence={work.firstSentence} />
        ) : null}

        <div className="mt-8">
          {/* Unlabeled, like a jacket's blurb; About the author keeps its
              label */}
          <h2 className="sr-only">
            About this book
          </h2>
          <p className="max-w-150 whitespace-pre-wrap leading-relaxed text-stone-700 dark:text-stone-300">
            {work.description
              ? stripMarkdown(work.description)
              : data.offline
                ? "Open Library isn't answering right now, so the details are missing for the moment."
                : "Open Library has no description for this one yet."}
          </p>
        </div>

        {work.authorDetails?.bio ? (
          <section className="mt-8">
            <h2 className="mb-2 text-sm font-semibold text-stone-500 dark:text-stone-400">
              {work.authorDetails.name
                ? `About ${work.authorDetails.name}`
                : "About the author"}
            </h2>
            <p className="max-w-150 whitespace-pre-wrap leading-relaxed text-stone-700 dark:text-stone-300">
              {work.authorDetails.bio}
            </p>
            <p className="mt-2 flex gap-4 text-sm">
              {work.authorDetails.wikipedia ? (
                <a
                  href={work.authorDetails.wikipedia}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={quietLink}
                >
                  Wikipedia
                </a>
              ) : null}
              <a
                href={`https://openlibrary.org/authors/${work.authorDetails.key}`}
                target="_blank"
                rel="noopener noreferrer"
                className={quietLink}
              >
                More on Open Library
              </a>
            </p>
          </section>
        ) : null}
        <SubjectTags subjects={subjects} title={work.title} className="mt-6" />

        {/* Your heart, read mark and note when it isn't on your shelf (on
            your shelf, they go on your copy), and your friends' */}
        <ReaderNotes
          notes={data.notes}
          myNote={data.myNote}
          canNote={!inLibrary}
          maxLength={data.noteMaxLength}
          friendIds={data.friendIds}
          readAt={data.myNote?.readAt ?? null}
        />

        <p className="mt-8 text-sm text-stone-400 dark:text-stone-500">
          Details from{" "}
          <a
            href={`https://openlibrary.org${work.key}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-stone-700 dark:hover:text-stone-200"
          >
            Open Library
          </a>
          .
        </p>
      </section>
    </main>
  );
}

export function ErrorBoundary() {
  return <ErrorPage what="book" />;
}

// Making this book what a group reads next, for someone in one or more:
// a button for one group, a choice of them for several. Picking takes you
// to the group, where it now sits at the top.
function PickForGroup({
  groups,
  work,
}: {
  groups: { id: string; name: string; reading: boolean }[];
  work: { key: string; title: string; author: string; cover: string };
}) {
  const [chosen, setChosen] = useState(groups.find((group) => !group.reading)?.id ?? groups[0].id);
  const group = groups.find((g) => g.id === chosen) ?? groups[0];
  const fields = (
    <>
      <input type="hidden" name="intent" value="pick" />
      <input type="hidden" name="key" value={work.key} />
      <input type="hidden" name="title" value={work.title} />
      <input type="hidden" name="author" value={work.author} />
      <input type="hidden" name="cover" value={work.cover} />
      <input type="hidden" name="groupName" value={group.name} />
    </>
  );
  if (groups.length === 1) {
    return group.reading ? (
      <p className="text-center text-sm text-stone-500 dark:text-stone-400">
        {group.name} is reading this
      </p>
    ) : (
      <Form method="post" action={groupPath(group)}>
        {fields}
        <button type="submit" className={`${quietButton("lg")} w-full`}>
          Pick for {group.name}
        </button>
      </Form>
    );
  }
  return (
    <Form method="post" action={groupPath(group)} className="flex flex-col gap-2">
      {fields}
      <label htmlFor="pick-group" className="text-sm text-stone-500 dark:text-stone-400">
        Pick for a group
      </label>
      <select
        id="pick-group"
        value={chosen}
        onChange={(event) => setChosen(event.target.value)}
        className="h-9 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 text-sm text-stone-900 dark:text-stone-100"
      >
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
            {g.reading ? " (reading it)" : ""}
          </option>
        ))}
      </select>
      <button type="submit" disabled={group.reading} className={`${quietButton("lg")} w-full disabled:opacity-50`}>
        {group.reading ? `${group.name} is reading this` : `Pick for ${group.name}`}
      </button>
    </Form>
  );
}
