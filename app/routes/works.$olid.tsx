
import { data, Form, Link, useFetcher, useLoaderData } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";

import Avatar from "~/components/avatar";
import BookCover from "~/components/book-cover";
import ClampedText from "~/components/clamped-text";
import ErrorPage from "~/components/error-page";
import { BookmarkIcon, CheckCircleIcon } from "~/components/icons";
import ReaderNotes from "~/components/reader-notes";
import SubjectTags from "~/components/subject-tags";
import { primaryButton, quietButton, sectionHeading } from "~/components/ui";
import { prisma } from "~/db.server";
import { isNotLending } from "~/lending";
import {
  createBook,
  findOwnCopy,
  searchFriendsBooks,
} from "~/models/book.server";
import { circleOf } from "~/models/circle.server";
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

  const [ownCopy, wanted, matches, myNote, notes] = await Promise.all([
    findOwnCopy(await shelfIds(userId), {
      title: work.title ?? "",
      openLibraryKey: key,
    }),
    isOnWantToRead(userId, { title: work.title ?? "", openLibraryKey: key }),
    searchFriendsBooks(userId, work.title ?? ""),
    getMyWorkNote(userId, key),
    getWorkNotes(userId, key),
  ]);
  // Friends' copies of this book, not just ones with a similar title
  const friendCopies = matches.filter((book) =>
    sameWork(
      { title: book.title, openLibraryKey: null },
      { title: work.title ?? "", openLibraryKey: null },
    ),
  );

  // Where you stand with each copy: asked for it already, or in line
  const copyIds = friendCopies.map((copy) => copy.id);
  const [asked, holds] = copyIds.length
    ? await Promise.all([
        prisma.notification.findMany({
          where: { type: "BOOK_REQUEST", senderId: userId, bookId: { in: copyIds }, read: false },
          select: { bookId: true },
        }),
        prisma.hold.findMany({ where: { userId, bookId: { in: copyIds } }, select: { bookId: true } }),
      ])
    : [[], []];

  return data({
    work,
    ownCopyId: ownCopy?.id ?? null,
    wanted,
    friendCopies: friendCopies.map((copy) => ({
      ...copy,
      requested: asked.some((request) => request.bookId === copy.id),
      inLine: holds.some((hold) => hold.bookId === copy.id),
    })),
    // To tell a copy lent to you from one lent to someone else
    userId,
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
    work.datePublished ? `Published ${work.datePublished}` : null,
    work.pageCount ? `${work.pageCount} pages` : null,
  ].filter(Boolean);

  const heading = (
    <>
      <h1 className="text-[1.75rem] md:text-5xl font-semibold tracking-tight leading-tight text-stone-900 dark:text-stone-100">
        {work.title}
      </h1>
      <p className="mt-1.5 text-lg md:mt-2 md:text-2xl text-stone-500 dark:text-stone-400">
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


  // Your heart, read mark and note when it isn't on your shelf (on your
  // shelf, they go on your copy), and your friends'
  const notes = (limit?: number, className?: string) => (
    <ReaderNotes
      notes={data.notes}
      myNote={data.myNote}
      canNote={!inLibrary}
      maxLength={data.noteMaxLength}
      friendIds={data.friendIds}
      readAt={data.myNote?.readAt ?? null}
      limit={limit}
      className={className}
    />
  );
  const notesUp = data.notes.some((note) => note.body && note.id !== data.myNote?.id);
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

        {/* Borrowing it instead: who has it, each to their shelf */}
        {data.friendCopies.length > 0 ? (
          <FriendCopies copies={data.friendCopies} userId={data.userId} />
        ) : null}
      </section>

      <section className="relative min-w-0 flex-1">
        <div className="hidden md:block">{heading}</div>

        <div className="mt-8">
          {/* Unlabeled, like a jacket's blurb; About the author keeps its
              label. Its first lines, the rest a tap away */}
          <h2 className="sr-only">About this book</h2>
          {work.description ? (
            <ClampedText id="description" text={stripMarkdown(work.description)} className="text-[17px] md:text-lg" />
          ) : (
            <p className="max-w-150 leading-relaxed text-stone-700 dark:text-stone-300">
              {data.offline
                ? "Open Library isn't answering right now, so the details are missing for the moment."
                : "Open Library has no description for this one yet."}
            </p>
          )}
        </div>

        {/* Then what friends thought, when there's something to read: the
            first two, the rest a tap away. With none, notes wait at the
            bottom */}
        {notesUp ? notes(2, "mt-10 max-w-150") : null}

        {work.authorDetails?.bio ? (
          <section className="mt-10">
            <h2 className={`${sectionHeading} mb-2`}>
              {work.authorDetails.name
                ? `About ${work.authorDetails.name}`
                : "About the author"}
            </h2>
            <p className="max-w-150 whitespace-pre-wrap leading-relaxed text-stone-700 dark:text-stone-300">
              {work.authorDetails.bio}
            </p>
            {/* Open Library gets its link once, in the credit below */}
            {work.authorDetails.wikipedia ? (
              <p className="mt-2 text-sm">
                <a
                  href={work.authorDetails.wikipedia}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={quietLink}
                >
                  Wikipedia
                </a>
              </p>
            ) : null}
          </section>
        ) : null}
        <SubjectTags subjects={subjects} title={work.title} className="mt-6" />

        {notesUp ? null : notes()}

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

interface FriendCopyData {
  id: string;
  title: string;
  borrowerId: string | null;
  notLendingUntil: string | Date | null;
  requested: boolean;
  inLine: boolean;
  user: { id: string; firstname: string; surname: string; profileEmoji: string | null };
}

// Who you know has it, said plainly: "Anika has a copy", "Sam's copy is
// lent out". Each opens their shelf, already looking for this book, to
// borrow it from there.
function FriendCopies({ copies, userId }: { copies: FriendCopyData[]; userId: string }) {
  const say = (copy: FriendCopyData) => {
    const name = <span className="font-medium text-stone-800 dark:text-stone-200 underline-offset-4 decoration-stone-300 dark:decoration-stone-600 group-hover:underline">{copy.user.firstname}</span>;
    if (copy.borrowerId === userId) return <>You&apos;re borrowing {name}&apos;s copy</>;
    if (copy.requested) return <>You asked {name} for it</>;
    if (copy.inLine) return <>You&apos;re in line for {name}&apos;s copy</>;
    if (isNotLending(copy.notLendingUntil)) return <>{name} has a copy, not lending right now</>;
    if (copy.borrowerId) return <>{name}&apos;s copy is lent out</>;
    return <>{name} has a copy</>;
  };
  // Yours first, then the ones you could borrow now, then the ones that are out
  const rank = (copy: FriendCopyData) =>
    copy.borrowerId === userId ? 0 : copy.borrowerId || isNotLending(copy.notLendingUntil) ? 2 : 1;
  return (
    <ul aria-label="Friends with a copy" className="pt-1">
      {[...copies].sort((a, b) => rank(a) - rank(b)).map((copy) => (
        <li key={copy.id}>
          <Link
            to={`/friend/${copy.user.id}?${new URLSearchParams({ q: copy.title })}`}
            // Their name underlines and an arrow points the way, as other
            // links to a list do
            className="group flex items-center gap-2.5 py-1.5 text-sm text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white transition-colors"
          >
            <Avatar firstname={copy.user.firstname} surname={copy.user.surname} icon={copy.user.profileEmoji} size="sm" />
            <span className="min-w-0">{say(copy)}</span>
            <span
              aria-hidden="true"
              className="-ml-1 text-stone-400 dark:text-stone-500 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
