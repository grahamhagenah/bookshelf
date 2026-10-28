import { useEffect, useRef, useState } from "react";
import { data, Form, Link, redirect, useActionData, useFetcher, useLoaderData, useNavigation, useRevalidator } from "react-router";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router";
import invariant from "tiny-invariant";

import Avatar from "~/components/avatar";
import CoverPlaceholder from "~/components/cover-placeholder";
import ErrorPage from "~/components/error-page";
import { LentIcon, PencilIcon } from "~/components/icons";
import OpeningLine, { openingLineType } from "~/components/opening-line";
import PersonLink from "~/components/person-link";
import ReaderNotes, { HideToggle, PinToggle } from "~/components/reader-notes";
import { primaryButton, quietButton, sectionHeading, textField } from "~/components/ui";
import { importCover, isOpenLibraryCover } from "~/covers.server";
import { daysUntil, dueText } from "~/due";
import { sendBookRequestEmail } from "~/email.server";
import { isNotLending, lendingAgainOn, NOT_LENDING_CHOICES, notLendingEnd, REQUEST_NOTE_MAX } from "~/lending";
import {
  deleteBook,
  getBookById,
  getReadAt,
  setRead,
  DEFAULT_LOAN_WEEKS,
  EXTEND_WEEKS,
  extendLoan,
  LOAN_WEEKS,
  setNotLending,
  lendToFriend,
  loanWeeks,
  returnBook,
  undoableReturn,
  undoReturn,
  updateBookMetadata,
  getLendingHistory,
  tidySubjects,
} from "~/models/book.server";
import { canInteract, respondAsDemoPersona } from "~/models/demo.server";
import {
  getHolds,
  handOn,
  leaveHold,
  passStraightOn,
  placeHold,
} from "~/models/hold.server";
import { shelfIds } from "~/models/household.server";
import { lendByEmail, lendByName } from "~/models/loan-invite.server";
import { nameList } from "~/models/name-list.server";
import {
  NOTE_MAX_LENGTH,
  canLeaveNote,
  getReaderNotes,
  saveReaderNote,
} from "~/models/note.server";
import { openLibraryJson } from "~/models/openlibrary-cache.server";
import {
  ensureBookDetails,
  fillInBookOnce,
  getAuthor,
  tidyAuthor,
  PATIENT_MS,
} from "~/models/openlibrary.server";
import {
  getUserById,
  getUserEmailById,
  createBookApprovedNotification,
  createBookRequestNotification,
  createBookReturnedNotification,
  createNotification,
  createReminderNotification,
  createLoanExtendedNotification,
  createReaderNoteNotification,
  getLoanReply,
} from "~/models/user.server";
import { moveToWantToRead } from "~/models/wish.server";
import {
  adoptWorkNotes,
  getFriendsWorkNotes,
  getMyWorkNote,
  saveWorkNote,
} from "~/models/work-note.server";
import {
  getPin,
  pinBook,
  setHiddenFromPage,
  unpinBook,
} from "~/profile.server";
import type { CoversResponse } from "~/routes/api.covers";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";
import { cleanSubjects, coverSrc, editionPublisher, ENGLISH_EDITION_FIELDS, ENGLISH_EDITION_PARAMS, type LoaderData, stripMarkdown, workPath } from "~/utils";

// "Oct 21", adding the year only when it isn't this year
const monthDay = (date: string | Date) => {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== new Date().getFullYear()
      ? { year: "numeric" }
      : {}),
  });
};

// A fix offered right where something's missing
const gapLink =
  "text-stone-700 dark:text-stone-200 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-900 dark:hover:text-stone-50";
const quietLabel =
  "rounded-md bg-stone-100 dark:bg-stone-800 px-4 py-2 text-sm text-stone-500 dark:text-stone-400 cursor-default";
const panel = "text-sm";
const labelClass =
  "block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5";

// "1920–1986" from Open Library's free-form dates
// Grey bars holding the place of text that's still on its way, one per
// line and a line of body text tall, so nothing jumps when it lands
function Placeholder({
  lines = 1,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={`block leading-relaxed ${className}`}>
      {Array.from({ length: lines }, (_, index) => (
        <span
          key={index}
          className={`block h-[1lh] py-[0.3em] ${
            index === lines - 1 && lines > 1 ? "w-2/3" : "w-full"
          }`}
        >
          <span className="block h-full rounded bg-stone-200/60 dark:bg-stone-800 motion-safe:animate-pulse" />
        </span>
      ))}
    </span>
  );
}

function AboutAuthor({
  author,
}: {
  author: {
    key: string;
    name: string;
    bio: string | null;
    birthDate: string | null;
    deathDate: string | null;
    wikipedia: string | null;
  };
}) {
  const linkClass =
    "text-stone-500 dark:text-stone-400 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-800 dark:hover:text-stone-200";

  const [open, setOpen] = useState(false);
  // Long enough to need cutting short? Guessed from the length first (so the
  // server and first paint agree), then measured once it's on screen
  const [long, setLong] = useState((author.bio?.length ?? 0) > 220);
  const bioRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const bio = bioRef.current;
    if (bio && !open) setLong(bio.scrollHeight > bio.clientHeight + 1);
  }, [open, author.bio]);
  const clipped = long && !open;

  // The first few lines of the bio, fading out, with the rest (and the
  // links) a tap away. The name itself is already at the top of the page,
  // and the bio usually opens with the dates, so neither repeats here.
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-sm font-semibold text-stone-500 dark:text-stone-400">
        About the author
      </h2>
      {author.bio ? (
        <p
          ref={bioRef}
          id={`bio-${author.key}`}
          className={`summary max-w-prose text-pretty leading-relaxed text-stone-700 dark:text-stone-300 ${
            clipped
              ? "line-clamp-3 [mask-image:linear-gradient(to_bottom,black_45%,transparent)]"
              : ""
          }`}
        >
          {author.bio}
        </p>
      ) : null}
      {long ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={`bio-${author.key}`}
          className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-stone-700 dark:text-stone-200 hover:text-stone-950 dark:hover:text-white"
        >
          {open ? "Show less" : "Read more"}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={`text-stone-400 transition-transform ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      ) : null}
      {!clipped ? (
        <p className="mt-2 flex gap-4 text-sm">
          {author.wikipedia ? (
            <a
              href={author.wikipedia}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClass}
            >
              Wikipedia
            </a>
          ) : null}
          <a
            href={`https://openlibrary.org/authors/${author.key}`}
            target="_blank"
            rel="noopener noreferrer"
            className={linkClass}
          >
            More on Open Library
          </a>
        </p>
      ) : null}
    </section>
  );
}

function BookCover({
  src,
  title,
  author,
  onAddCover,
  fetching = false,
}: {
  src: string;
  title: string;
  author: string;
  // For the owner: the placeholder offers to fix a missing cover, and a
  // cover that's there opens the editor when clicked
  onAddCover?: () => void;
  // A pasted cover is being fetched and kept by the save that's under way
  fetching?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(!src);
  const showCover = (img: HTMLImageElement) => {
    // Open Library answers unknown covers with a 1x1 pixel, and a broken
    // image has no width at all
    if (img.naturalWidth <= 1) setError(true);
    else setLoaded(true);
  };
  // A new cover starts over: what the last one did is no guide to it.
  // Without this, a book whose cover had failed never showed the one
  // saved in its place until the page was reloaded.
  useEffect(() => {
    setLoaded(false);
    setError(!src);
  }, [src]);
  // The picture is on its way: being fetched by the save, or loading
  const waiting = fetching || Boolean(src && !loaded && !error);

  return (
    // The cover keeps its own proportions here (some are taller or wider
    // than 2:3); the placeholder holds a 2:3 space until it arrives
    <div
      className={`relative flex-shrink-0 w-[120px] md:w-[200px] lg:w-[240px] overflow-hidden rounded-xs shadow-sm ring-1 ring-stone-900/5 dark:ring-white/10 ${
        loaded && !error ? "" : "aspect-[2/3]"
      }`}
    >
      {!loaded || error ? (
        <CoverPlaceholder
          title={title}
          author={author}
          className={`absolute inset-0 ${waiting ? "animate-pulse" : ""}`}
          roomBelow={fetching || Boolean(error && onAddCover)}
        />
      ) : null}
      {fetching ? (
        <p
          role="status"
          className="absolute inset-x-2 bottom-2 rounded-md bg-white/90 dark:bg-stone-900/90 px-2 py-1.5 text-center text-xs font-medium text-stone-700 dark:text-stone-200 shadow-sm ring-1 ring-stone-900/10 dark:ring-white/10"
        >
          Fetching the cover…
        </p>
      ) : null}
      {error && onAddCover && !fetching ? (
        <button
          type="button"
          onClick={onAddCover}
          className="absolute inset-x-2 bottom-2 rounded-md bg-white/90 dark:bg-stone-900/90 px-2 py-1.5 text-xs font-medium text-stone-800 dark:text-stone-100 shadow-sm ring-1 ring-stone-900/10 dark:ring-white/10 hover:bg-white dark:hover:bg-stone-900 transition-colors"
        >
          Add a cover
        </button>
      ) : null}
      {!error && src ? (
        <img
          src={coverSrc(src)}
          // The title is the heading beside it. An empty alt also means a
          // cover that fails shows nothing at all, where Safari would draw
          // the title and a "?" over the placeholder until the page's
          // script noticed the failure
          alt=""
          // At the top of the page, so there's nothing to wait for; Safari
          // can also miss a lazy image's failure
          loading="eager"
          decoding="async"
          // Visible from the first paint; it fills the 2:3 box until its
          // own size is known, then keeps its proportions
          className={`w-full object-cover ${
            loaded
              ? // No taller than twice the width, however odd the image
                "relative block h-auto max-h-[240px] md:max-h-[400px] lg:max-h-[480px]"
              : "absolute inset-0 h-full"
          }`}
          // A cached cover can finish loading before React hydrates and
          // attaches onLoad, so also check it once it's in the page
          ref={(img) => {
            if (img?.complete) showCover(img);
          }}
          onLoad={(e) => showCover(e.currentTarget)}
          onError={() => setError(true)}
        />
      ) : null}
      {/* The whole cover is the button; its label shows on hover, or when
          reached by keyboard */}
      {loaded && !error && onAddCover && !fetching ? (
        <button
          type="button"
          onClick={onAddCover}
          aria-label="Change cover"
          className="group absolute inset-0 flex items-end justify-center p-2 focus-visible:outline-none"
        >
          <span className="inline-flex items-center gap-1.5 rounded-md bg-white/90 dark:bg-stone-900/90 px-2 py-1.5 text-xs font-medium text-stone-800 dark:text-stone-100 shadow-sm ring-1 ring-stone-900/10 dark:ring-white/10 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <PencilIcon size={12} />
            Change cover
          </span>
        </button>
      ) : null}
    </div>
  );
}

interface BreadcrumbData {
  book: {
    title: string;
    user?: {
      id: string;
      firstname: string;
      surname: string;
    };
  };
  isOwner: boolean;
}

export const meta: MetaFunction<typeof loader> = ({ loaderData }) =>
  seo({
    title: loaderData?.book ? `${loaderData.book.title} by ${loaderData.book.author}` : "Book",
    noindex: true,
  });

export const handle = {
  breadcrumbs: (data: BreadcrumbData) => {
    const crumbs: { label: string; href?: string }[] = [];

    // Your own book sits in your library; a friend's, on their shelf
    if (data?.isOwner) {
      crumbs.push({ label: "My shelf", href: "/books" });
    } else if (data?.book?.user) {
      crumbs.push({ label: "Friends", href: "/friends" });
      crumbs.push({
        label: `${data.book.user.firstname} ${data.book.user.surname}`,
        href: `/friend/${data.book.user.id}`,
      });
    }

    // Always add the book title
    crumbs.push({ label: data?.book?.title || "Book" });

    return crumbs;
  },
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  invariant(params.bookId, "bookId not found");

  let book = await getBookById(params.bookId);
  if (!book) {
    throw new Response("Not Found", { status: 404 });
  }

  // First visit: the opening sentence, the author and any missing
  // details come from Open Library. The page doesn't wait for them; it
  // starts the look-up, shows what it has, and reloads when they're in.
  const fillingIn = !book.detailsFetchedAt;
  if (fillingIn) void fillInBookOnce(book.id);
  const [subjects, authorName] = await Promise.all([
    tidySubjects(book),
    tidyAuthor(book),
  ]);
  if (subjects !== undefined) book = { ...book, subjects };
  if (authorName !== undefined) book = { ...book, author: authorName };

  // Owner means anyone sharing the shelf the book is on
  const isOwner = (await shelfIds(userId)).includes(book.userId);
  const isBorrower = book.borrowerId === userId;
  const isBorrowed = book.borrowerId !== null;

  const currentUser = await getUserById(userId);
  const followingIds = currentUser?.following?.map((friend) => friend.id) ?? [];
  // A friend of anyone on that shelf is a friend of the shelf
  const ownerShelf = await shelfIds(book.userId);
  const isFriend = ownerShelf.some((id) => followingIds.includes(id));

  // If not the owner, check if the owner is a friend, borrower, or has public sharing
  if (!isOwner && !isBorrower && !isFriend) {
    // Check if owner has public sharing enabled
    const ownerHasPublicSharing = book.user?.shareToken !== null;
    if (!ownerHasPublicSharing) {
      throw new Response("Not Found", { status: 404 });
    }
  }

  // Fetch lending history and reader notes for the book
  const [lendingHistory, readerNotes, canNote, author, holds] =
    await Promise.all([
      getLendingHistory(params.bookId),
      getReaderNotes(params.bookId),
      canLeaveNote(userId, book),
      getAuthor(book.authorKey),
      getHolds(params.bookId),
    ]);
  // Friends who read it somewhere else, and said something about it
  const readElsewhere = book.openLibraryKey
    ? await getFriendsWorkNotes(
        userId,
        book.openLibraryKey,
        readerNotes.map((note) => note.user.id),
      )
    : [];
  // A friend's copy you've never had: you may still have read the book.
  // Your heart, read mark and note go on the book itself, as on its Open
  // Library page (and in Read elsewhere), and show here with the rest.
  const workKey = workPath(book.openLibraryKey) ? book.openLibraryKey : null;
  const elsewhere = !canNote && workKey !== null;
  const myWorkNote = elsewhere ? await getMyWorkNote(userId, workKey) : null;
  // How each writer knows the book, shown under their name: this copy
  // (theirs, or borrowed, and when), or another one somewhere else
  const copyTie = (writerId: string) => {
    if (ownerShelf.includes(writerId)) {
      return writerId === userId ? "Your copy" : "Owns this copy";
    }
    // The lending history is newest first
    const loan = lendingHistory.find((entry) => entry.borrower.id === writerId);
    if (!loan) return null;
    if (!loan.returnedAt) return "Borrowing this copy now";
    const when = new Date(loan.borrowedAt);
    return `Borrowed this copy in ${when.toLocaleDateString("en-US", {
      month: "long",
      ...(when.getFullYear() !== new Date().getFullYear()
        ? { year: "numeric" }
        : {}),
    })}`;
  };
  const notes = [
    ...readerNotes.map((note) => ({ ...note, context: copyTie(note.user.id) })),
    ...[
      ...readElsewhere,
      ...(myWorkNote && (myWorkNote.loved || myWorkNote.body)
        ? [myWorkNote]
        : []),
    ].map((note) => ({ ...note, context: "Read it elsewhere" })),
  ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  // Where you are in line for this book, counting from 1
  const holdIndex = holds.findIndex((hold) => hold.user.id === userId);

  // Mark which borrowers in history are friends
  const lendingHistoryWithFriendStatus = lendingHistory.map((entry) => ({
    ...entry,
    isFriend: followingIds.includes(entry.borrower.id),
    isCurrentUser: entry.borrower.id === userId,
  }));

  return data({
    book,
    // The viewer's own read mark; their housemate has their own. On a
    // friend's copy they've never had, the one on the book itself.
    readAt: elsewhere
      ? (myWorkNote?.readAt ?? null)
      : await getReadAt(userId, book),
    isOwner,
    isBorrowed,
    isBorrower,
    isFriend,
    currentUser,
    lendingHistory: lendingHistoryWithFriendStatus,
    readerNotes: notes,
    myNote: elsewhere
      ? myWorkNote
      : (readerNotes.find((note) => note.user.id === userId) ?? null),
    canNote: canNote || elsewhere,
    noteMaxLength: NOTE_MAX_LENGTH,
    extendWeeks: EXTEND_WEEKS,
    loanChoices: { weeks: LOAN_WEEKS, defaultWeeks: DEFAULT_LOAN_WEEKS },
    // People the owner lent to by name before, to pick again
    lentByName: isOwner ? await nameList(userId) : [],
    // Who's waiting is shown to the owner and the borrower; others just
    // see their own place
    waiting:
      isOwner || isBorrower
        ? holds.map((hold) => ({ ...hold.user, since: hold.createdAt }))
        : [],
    linePosition: holdIndex === -1 ? null : holdIndex + 1,
    author,
    friendIds: followingIds,
    // The latest return, while the owner can still say it never came back
    undoableReturnId: isOwner
      ? ((await undoableReturn(book.id))?.id ?? null)
      : null,
    // What the lender said when they said yes, for the one borrowing it
    loanReply: isBorrower ? await getLoanReply(book.id, userId) : null,
    fillingIn,
    // Where this book stands on the viewer's public page: theirs to pin
    // or keep off, or, once they've borrowed it, theirs to pin
    page:
      isOwner || lendingHistory.some((entry) => entry.borrower.id === userId)
        ? {
            ...(await getPin(userId, book.id)),
            own: isOwner,
            hidden: book.hiddenFromPage,
          }
        : null,
  });
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  invariant(params.bookId, "bookId not found");

  const formData = await request.formData();
  const intent = formData.get("intent");

  const book = await getBookById(params.bookId);
  if (!book) {
    throw new Response("Not Found", { status: 404 });
  }
  // Anyone sharing the shelf the book is on can manage it
  const managerIds = await shelfIds(userId);

  // Your public page: pin it (pinBook checks it's yours or borrowed), or,
  // when it's from your shelf, keep it off
  if (
    intent === "pin" ||
    intent === "unpin" ||
    intent === "hideFromPage" ||
    intent === "showOnPage"
  ) {
    if (
      (intent === "hideFromPage" || intent === "showOnPage") &&
      !managerIds.includes(book.userId)
    ) {
      throw new Response("Not Found", { status: 404 });
    }
    if (intent === "pin") {
      const result = await pinBook(userId, book.id);
      return data(result.ok ? { pinned: true } : { pinError: result.error });
    }
    if (intent === "unpin") await unpinBook(userId, book.id);
    if (intent === "hideFromPage" || intent === "showOnPage") {
      await setHiddenFromPage(userId, book.id, intent === "hideFromPage");
    }
    return data({ ok: true });
  }

  // A friend's copy you've never had: a heart, read mark or note goes on
  // the book itself, as on its Open Library page, rather than this copy
  if (
    (intent === "toggleRead" ||
      intent === "toggleLove" ||
      intent === "saveNote" ||
      intent === "deleteNote") &&
    book.openLibraryKey &&
    workPath(book.openLibraryKey) &&
    !(await canLeaveNote(userId, book))
  ) {
    const body = formData.get("body");
    await saveWorkNote(
      userId,
      {
        key: book.openLibraryKey,
        title: book.title,
        author: book.author,
        cover: book.cover,
      },
      intent === "toggleLove"
        ? { loved: formData.get("loved") === "true" }
        : intent === "toggleRead"
          ? { read: formData.get("read") === "true" }
          : {
              body:
                intent === "saveNote" && typeof body === "string" ? body : null,
            },
    );
    return data(
      intent === "saveNote" || intent === "deleteNote"
        ? { noteSaved: true }
        : { ok: true },
    );
  }

  if (intent === "toggleRead") {
    if (!(await canLeaveNote(userId, book))) {
      throw new Response("Only readers of this copy can mark it read", {
        status: 403,
      });
    }
    await setRead(book.id, userId, formData.get("read") === "true");
    return data({ ok: true });
  }

  if (
    intent === "toggleLove" ||
    intent === "saveNote" ||
    intent === "deleteNote"
  ) {
    if (!(await canLeaveNote(userId, book))) {
      throw new Response("Only readers of this copy can leave notes", {
        status: 403,
      });
    }
    const body = formData.get("body");
    const note =
      intent === "toggleLove"
        ? await saveReaderNote(userId, book.id, {
            loved: formData.get("loved") === "true",
          })
        : await saveReaderNote(userId, book.id, {
            body:
              intent === "saveNote" && typeof body === "string" ? body : null,
          });

    // Let the owner know when a reader hearts or writes about their book
    if (book.userId !== userId && (note.loved || note.body)) {
      const reader = await getUserById(userId);
      if (reader) {
        await createReaderNoteNotification(
          userId,
          book.userId,
          `${reader.firstname} ${reader.surname}`,
          book.id,
          book.title,
        );
      }
    }
    return data({ noteSaved: true });
  }

  // Added by mistake, not owned: off the shelf and onto your list
  if (intent === "moveToWant") {
    if (book.userId !== userId) {
      throw new Response("Unauthorized", { status: 403 });
    }
    const moved = await moveToWantToRead(userId, book.id);
    if (moved.ok) return redirect("/want-to-read");
    return data(
      { error: "This copy has been lent, so it stays on your shelf. Delete it from Edit if you must." },
      { status: 400 },
    );
  }

  if (intent === "delete") {
    // Verify ownership before deleting
    if (!managerIds.includes(book.userId)) {
      throw new Response("Unauthorized", { status: 403 });
    }
    await deleteBook({ id: params.bookId, userId });
    return redirect("/books");
  }

  if (intent === "request") {
    // Can't request your own book
    if (managerIds.includes(book.userId)) {
      throw new Response("Cannot request your own book", { status: 400 });
    }
    // Can't request an already borrowed book
    if (book.borrowerId !== null) {
      throw new Response("Book is already borrowed", { status: 400 });
    }
    // Nor one its owner isn't lending right now
    if (isNotLending(book.notLendingUntil)) {
      throw new Response("Not lending this book right now", { status: 400 });
    }
    if (!(await canInteract(userId, book.userId))) {
      throw new Response("Not Found", { status: 404 });
    }

    const currentUser = await getUserById(userId);
    if (!currentUser) {
      throw new Response("User not found", { status: 404 });
    }

    const senderName = `${currentUser.firstname} ${currentUser.surname}`;
    const message =
      String(formData.get("message") ?? "")
        .trim()
        .slice(0, REQUEST_NOTE_MAX) || null;
    const bookRequest = await createBookRequestNotification(
      userId,
      book.userId,
      senderName,
      book.id,
      book.title,
      message,
    );

    // Demo friends approve on the spot
    await respondAsDemoPersona(bookRequest.id);

    // Send email notification to book owner (if they have email notifications enabled)
    const bookOwner = await getUserEmailById(book.userId);
    if (
      bookOwner &&
      bookOwner.emailNotifications &&
      bookOwner.emailVerifiedAt
    ) {
      await sendBookRequestEmail({
        toEmail: bookOwner.email,
        toUserId: book.userId,
        toName: bookOwner.firstname || "there",
        requesterName: senderName,
        bookTitle: book.title,
        bookAuthor: book.author,
        bookCover: book.cover,
        message,
      });
    }

    return data({ success: true, message: "Book request sent!" });
  }

  if (intent === "placeHold" || intent === "leaveHold") {
    if (intent === "leaveHold") {
      await leaveHold(book.id, userId);
      return data({ leftLine: true });
    }
    // Only for a friend's book that someone else has right now
    const viewer = await getUserById(userId);
    const isFriend =
      viewer?.following.some((friend) => friend.id === book.userId) ?? false;
    if (
      managerIds.includes(book.userId) ||
      !book.borrowerId ||
      book.borrowerId === userId ||
      isNotLending(book.notLendingUntil) ||
      !isFriend ||
      !(await canInteract(userId, book.userId))
    ) {
      throw new Response("Can't wait for this book", { status: 400 });
    }
    await placeHold(book.id, userId);
    return data({ joinedLine: true });
  }

  // The owner stops lending it for a while, or starts again
  if (intent === "stopLending" || intent === "resumeLending") {
    if (!managerIds.includes(book.userId)) {
      throw new Response("Unauthorized", { status: 403 });
    }
    const until =
      intent === "stopLending" ? notLendingEnd(formData.get("for")) : null;
    if (intent === "stopLending" && !until) {
      throw new Response("Choose how long", { status: 400 });
    }
    await setNotLending(book.id, until);
    return data({ ok: true });
  }

  if (intent === "lendTo") {
    // The owner hands their own book to a friend
    if (!managerIds.includes(book.userId)) {
      throw new Response("Unauthorized", { status: 403 });
    }
    if (book.borrowerId !== null) {
      throw new Response("Book is already lent out", { status: 400 });
    }
    const friendId = formData.get("friendId");
    const weeks = loanWeeks(formData.get("weeks"));
    // Someone who isn't a friend on Stacks: by email, or by name alone
    if (friendId === "new") {
      const name = formData.get("name");
      const email = formData.get("email");
      const typedName = typeof name === "string" ? name : "";
      const typedEmail = typeof email === "string" ? email.trim() : "";
      const result = typedEmail
        ? await lendByEmail(userId, book, { name: typedName, email: typedEmail, weeks })
        : await lendByName(userId, book, { name: typedName, weeks });
      if (!result.ok) {
        return data({ lendError: result.error }, { status: 400 });
      }
      return data({ lentTo: result.borrowerId, invited: result.invited });
    }
    const owner = await getUserById(userId);
    // Someone this shelf lent to by name before, again
    if (
      owner &&
      typeof friendId === "string" &&
      (await nameList(userId)).some((person) => person.id === friendId)
    ) {
      await lendToFriend(book.id, userId, friendId, weeks);
      return data({ lentTo: friendId });
    }
    const isFriend =
      typeof friendId === "string" &&
      (owner?.following.some((friend) => friend.id === friendId) ?? false);
    if (!owner || !isFriend || !(await canInteract(userId, friendId))) {
      throw new Response("Not a friend", { status: 400 });
    }

    await lendToFriend(book.id, userId, friendId, weeks);
    await createBookApprovedNotification(
      userId,
      friendId,
      `${owner.firstname} ${owner.surname}`,
      book.title,
      book.id,
    );
    return data({ lentTo: friendId });
  }

  if (intent === "return") {
    // Only the borrower can return the book
    if (book.borrowerId !== userId) {
      throw new Response("Unauthorized", { status: 403 });
    }

    const currentUser = await getUserById(userId);
    if (!currentUser) {
      throw new Response("User not found", { status: 404 });
    }

    const senderName = `${currentUser.firstname} ${currentUser.surname}`;
    await createBookReturnedNotification(
      userId,
      book.userId,
      senderName,
      book.title,
      book.id,
    );

    await returnBook(book.id);
    await handOn(book.id, userId);
    return redirect("/books");
  }

  // Handed straight to whoever's next in line, as a book club does
  if (intent === "passOn") {
    if (book.borrowerId !== userId) {
      throw new Response("Unauthorized", { status: 403 });
    }
    const passed = await passStraightOn(book.id, userId);
    if (!passed) {
      return data({ passError: "No one's waiting for it now. Return it instead." }, { status: 400 });
    }
    return redirect("/books");
  }

  // It was marked returned, but it never actually came back
  if (intent === "undoReturn") {
    if (!managerIds.includes(book.userId)) {
      throw new Response("Unauthorized", { status: 403 });
    }
    const owner = await getUserById(userId);
    const undone = owner
      ? await undoReturn(book.id, {
          id: userId,
          name: `${owner.firstname} ${owner.surname}`,
        })
      : null;
    return data({ returnUndone: Boolean(undone) });
  }

  if (intent === "friendRequest") {
    // Check if there's a specific target user (from lending history)
    const targetUserId = formData.get("targetUserId");
    const targetId =
      typeof targetUserId === "string" ? targetUserId : book.userId;

    // Can't send friend request to yourself
    if (targetId === userId) {
      throw new Response("Cannot send friend request to yourself", {
        status: 400,
      });
    }
    if (!(await canInteract(userId, targetId))) {
      throw new Response("Not Found", { status: 404 });
    }
    const currentUser = await getUserById(userId);
    if (!currentUser) {
      throw new Response("User not found", { status: 404 });
    }

    const senderName = `${currentUser.firstname} ${currentUser.surname}`;
    const friendRequest = await createNotification(
      userId,
      targetId,
      senderName,
    );

    await respondAsDemoPersona(friendRequest.id);

    return data({ friendRequestSent: true, message: "Friend request sent!" });
  }

  if (intent === "extendLoan" || intent === "markReturned") {
    // Only the owner manages a loan from this side
    if (!managerIds.includes(book.userId)) {
      throw new Response("Unauthorized", { status: 403 });
    }
    if (!book.borrowerId) {
      throw new Response("Book is not currently borrowed", { status: 400 });
    }

    if (intent === "markReturned") {
      // The book came back in person, without the borrower pressing Return
      await returnBook(book.id);
      await handOn(book.id, userId);
      return data({ markedReturned: true });
    }

    await extendLoan(book.id, loanWeeks(formData.get("weeks"), EXTEND_WEEKS));
    const owner = await getUserById(userId);
    if (owner) {
      await createLoanExtendedNotification(
        userId,
        book.borrowerId,
        `${owner.firstname} ${owner.surname}`,
        book.id,
        book.title,
      );
    }
    return data({ loanExtended: true });
  }

  if (intent === "sendReminder") {
    // Only owner can send reminder
    if (!managerIds.includes(book.userId)) {
      throw new Response("Unauthorized", { status: 403 });
    }

    // Book must be borrowed
    if (!book.borrowerId) {
      throw new Response("Book is not currently borrowed", { status: 400 });
    }

    const currentUser = await getUserById(userId);
    if (!currentUser) {
      throw new Response("User not found", { status: 404 });
    }

    const ownerName = `${currentUser.firstname} ${currentUser.surname}`;
    // "Overdue" only once the due date has passed; before that it's a nudge
    const overdue =
      book.dueDate !== null && book.dueDate.getTime() < Date.now();
    await createReminderNotification(
      userId,
      book.borrowerId,
      ownerName,
      book.id,
      book.title,
      overdue,
    );

    return data({ reminderSent: true, message: "Reminder sent!" });
  }

  if (intent === "refresh") {
    // Only owner can refresh metadata
    if (!managerIds.includes(book.userId)) {
      throw new Response("Unauthorized", { status: 403 });
    }

    // Search Open Library for this book
    const searchQuery = encodeURIComponent(`${book.title} ${book.author}`);
    const fields = [
      "title",
      "author_name",
      "first_publish_year",
      "number_of_pages_median",
      "subject",
      "key",
      ENGLISH_EDITION_FIELDS,
    ].join(",");

    // Asked for, so straight to Open Library, falling back on what's kept
    const data = await openLibraryJson(
      `https://openlibrary.org/search.json?q=${searchQuery}&limit=1&${ENGLISH_EDITION_PARAMS}&fields=${fields}`,
      { timeoutMs: PATIENT_MS, fresh: true },
    ).catch(() => ({ docs: [] }));

    if (data.docs && data.docs.length > 0) {
      const bookData = data.docs[0];

      // Fetch description from Works API
      let description = book.body;
      if (bookData.key) {
        try {
          const workData = await openLibraryJson(
            `https://openlibrary.org${bookData.key}.json`,
            { timeoutMs: PATIENT_MS, fresh: true },
          );
          if (typeof workData.description === "string") {
            description = workData.description;
          } else if (workData.description?.value) {
            description = workData.description.value;
          }
        } catch {
          // Keep existing description if fetch fails
        }
      }

      await updateBookMetadata(book.id, {
        datePublished: bookData.first_publish_year?.toString() || null,
        pageCount: bookData.number_of_pages_median || null,
        subjects: cleanSubjects(bookData.subject).join(", ") || null,
        publisher: editionPublisher(bookData),
        openLibraryKey: bookData.key || null,
        body: description,
      });
      await ensureBookDetails(
        { id: book.id, detailsFetchedAt: null },
        { force: true },
      );
      await adoptWorkNotes(book.id);
      return data({
        refreshed: true,
        message: "Book info updated from Open Library!",
      });
    }

    return data({
      refreshed: false,
      message: "Could not find book on Open Library.",
    });
  }

  if (intent === "edit") {
    // Only owner can edit
    if (!managerIds.includes(book.userId)) {
      throw new Response("Unauthorized", { status: 403 });
    }

    const title = formData.get("title");
    const author = formData.get("author");
    const cover = formData.get("cover");
    const body = formData.get("body");
    const datePublished = formData.get("datePublished");
    const pageCount = formData.get("pageCount");
    const publisher = formData.get("publisher");
    const subjects = formData.get("subjects");

    // A cover pasted from another site is fetched once and kept here, so
    // it's served like any other and doesn't depend on that site
    let coverToSave = typeof cover === "string" && cover ? cover : undefined;
    if (
      coverToSave &&
      /^https?:/.test(coverToSave) &&
      !isOpenLibraryCover(coverToSave)
    ) {
      const local = await importCover(coverToSave);
      if (!local) {
        return data({
          edited: false,
          coverError:
            "That cover couldn't be fetched. Use an image link from Open Library, Amazon, Goodreads, Google Books, Bookshop.org, Wikipedia or the Internet Archive, under 5 MB.",
        });
      }
      coverToSave = local;
    }

    await updateBookMetadata(book.id, {
      title: typeof title === "string" ? title : undefined,
      author: typeof author === "string" ? author : undefined,
      cover: coverToSave,
      body: typeof body === "string" ? body : undefined,
      datePublished:
        typeof datePublished === "string" && datePublished
          ? datePublished
          : null,
      pageCount:
        typeof pageCount === "string" && pageCount
          ? parseInt(pageCount, 10)
          : null,
      publisher: typeof publisher === "string" && publisher ? publisher : null,
      subjects: typeof subjects === "string" && subjects ? subjects : null,
    });

    return data({ edited: true, message: "Book updated successfully!" });
  }

  return null;
};

// For a friend's book that's out on loan: join the line for it, or see
// your place in it
function WaitInLine({ position }: { position: number | null }) {
  const navigation = useNavigation();
  const pending = navigation.formData?.get("intent");

  if (position === null) {
    return (
      <Form method="post">
        <input type="hidden" name="intent" value="placeHold" />
        <button
          type="submit"
          disabled={pending === "placeHold"}
          className={`w-full ${primaryButton("lg")} ${pending === "placeHold" ? "opacity-60 cursor-wait" : ""}`}
        >
          {pending === "placeHold" ? "Joining…" : "Get in line"}
        </button>
        <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400">
          When it comes back, we&apos;ll ask for it for you.
        </p>
      </Form>
    );
  }

  return (
    <div>
      <p className="w-full cursor-default rounded-md border border-stone-200 dark:border-stone-700 px-4 py-2 text-center text-sm text-stone-600 dark:text-stone-300">
        {position === 1 ? "You're next in line" : `You're #${position} in line`}
      </p>
      <Form method="post" className="mt-1.5 text-center">
        <input type="hidden" name="intent" value="leaveHold" />
        <button
          type="submit"
          className="text-xs text-stone-500 dark:text-stone-400 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-800 dark:hover:text-stone-200"
        >
          Leave the line
        </button>
      </Form>
    </div>
  );
}

// Lend your book to a friend directly, without waiting for them to ask
// The owner can stop lending a copy for a while, or until they say:
// friends see it isn't lending, and can't ask for it or wait for it
// Whether the owner is lending this one, as it will be while a change
// saves. Both the notice on the page and the setting under Edit details
// share one fetcher, so either shows the other's change at once.
function useNotLending(until: string | Date | null) {
  const fetcher = useFetcher({ key: "not-lending" });
  const pending = fetcher.formData?.get("intent");
  const off =
    pending === "stopLending"
      ? true
      : pending === "resumeLending"
        ? false
        : isNotLending(until);
  const againOn = pending ? null : lendingAgainOn(until);
  return { fetcher, off, againOn };
}

// On the page itself, only while it's off: easy to forget otherwise
function NotLendingNotice({ until }: { until: string | Date | null }) {
  const { fetcher, off, againOn } = useNotLending(until);
  if (!off) return null;
  return (
    <fetcher.Form
      method="post"
      className="rounded-md border border-stone-200 dark:border-stone-700 px-3 py-2.5 text-sm"
    >
      <input type="hidden" name="intent" value="resumeLending" />
      <p className="font-medium text-stone-800 dark:text-stone-200">
        Not lending
      </p>
      <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
        {againOn
          ? `Friends can ask for it again on ${monthDay(againOn)}.`
          : "Friends can't ask for it until you lend it again."}{" "}
        <button type="submit" className={gapLink}>
          Lend it again
        </button>
      </p>
    </fetcher.Form>
  );
}

// Under Edit details, beside Refresh and Delete: rarely needed
function NotLendingSetting({ until }: { until: string | Date | null }) {
  const { fetcher, off, againOn } = useNotLending(until);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="text-sm">
        <p className="font-medium text-stone-800 dark:text-stone-200">
          {off ? "Not lending" : "Not lending this one for now?"}
        </p>
        <p className="text-stone-500 dark:text-stone-400">
          {off
            ? againOn
              ? `Friends can ask for it again on ${monthDay(againOn)}.`
              : "Friends can't ask for it until you lend it again."
            : "Friends still see it, but can't ask for it or get in line."}
        </p>
      </div>
      {off ? (
        <fetcher.Form method="post" className="flex-shrink-0">
          <input type="hidden" name="intent" value="resumeLending" />
          <button type="submit" className={quietButton("lg")}>
            Lend it again
          </button>
        </fetcher.Form>
      ) : (
        <fetcher.Form method="post" className="flex flex-shrink-0 gap-2">
          <input type="hidden" name="intent" value="stopLending" />
          <label className="sr-only" htmlFor="not-lending-for">
            For how long
          </label>
          <select
            id="not-lending-for"
            name="for"
            defaultValue="forever"
            className="h-9 min-w-0 flex-1 rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 text-sm text-stone-800 dark:text-stone-200 focus:outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10 sm:flex-none"
          >
            {NOT_LENDING_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
          <button type="submit" className={quietButton("lg")}>
            Stop lending
          </button>
        </fetcher.Form>
      )}
    </div>
  );
}

function LendToFriend({
  friends,
  loanChoices,
  byEmail,
  open,
  onOpen,
  onClose,
}: {
  friends: { id: string; firstname: string; surname: string }[];
  loanChoices: { weeks: readonly number[]; defaultWeeks: number };
  // Telling someone not on Stacks by email: open, waiting on a confirmed
  // email, or not in the demo. Lending to them by name is always open.
  byEmail: "ok" | "confirm-email" | "off";
  // Kept by the page, so the bar on phones can open it too
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const navigation = useNavigation();
  const actionData = useActionData<{ lendError?: string }>();
  const lending = navigation.formData?.get("intent") === "lendTo";
  const sorted = [...friends].sort((a, b) =>
    `${a.firstname} ${a.surname}`.localeCompare(`${b.firstname} ${b.surname}`),
  );
  // With no friends yet, someone new is the only choice
  const [choice, setChoice] = useState(sorted.length === 0 ? "new" : "");
  const field =
    "h-9 w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 text-sm text-stone-800 dark:text-stone-200 focus:outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10";
  const label = "block text-xs font-medium text-stone-500 dark:text-stone-400";
  const someoneNew = choice === "new";

  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className={`w-full ${quietButton("lg")}`}
      >
        Lend this book
      </button>
    );
  }

  return (
    <Form method="post" className="space-y-2">
      <input type="hidden" name="intent" value="lendTo" />
      {sorted.length > 0 ? (
        <label className={label}>
          Lend to
          <select
            name="friendId"
            required
            className={`mt-1 ${field}`}
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
          >
            <option value="" disabled>
              Choose someone
            </option>
            {sorted.map((friend) => (
              <option key={friend.id} value={friend.id}>
                {friend.firstname} {friend.surname}
              </option>
            ))}
            <option value="new">Someone else…</option>
          </select>
        </label>
      ) : (
        <input type="hidden" name="friendId" value="new" />
      )}
      {someoneNew ? (
        <>
          <label className={label}>
            Their name
            <input
              name="name"
              required
              autoComplete="off"
              className={`mt-1 ${field}`}
            />
          </label>
          {byEmail === "off" ? null : (
            <label className={label}>
              Their email <span className="font-normal">(optional)</span>
              <input
                name="email"
                type="email"
                autoComplete="off"
                className={`mt-1 ${field}`}
              />
            </label>
          )}
          <p className="text-xs text-stone-500 dark:text-stone-400">
            {byEmail === "off"
              ? "Reminders come to you."
              : "With an email, they get a link to the loan. Without one, reminders come to you."}
            {byEmail === "confirm-email" ? (
              <>
                {" "}
                To email them,{" "}
                <Link
                  to="/account#emails"
                  className="text-stone-800 dark:text-stone-200 underline underline-offset-2"
                >
                  confirm your email
                </Link>{" "}
                first.
              </>
            ) : null}{" "}
            Lending to a class?{" "}
            <Link
              to="/checkout"
              className="text-stone-800 dark:text-stone-200 underline underline-offset-2"
            >
              Use the check-out desk
            </Link>
            .
          </p>
        </>
      ) : null}
      <label className={label}>
        For
        <select
          name="weeks"
          defaultValue={loanChoices.defaultWeeks}
          className={`mt-1 ${field}`}
        >
          {loanChoices.weeks.map((weeks) => (
            <option key={weeks} value={weeks}>
              {weeks} {weeks === 1 ? "week" : "weeks"}
            </option>
          ))}
        </select>
      </label>
      {actionData?.lendError ? (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {actionData.lendError}
        </p>
      ) : null}
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={lending}
          className={`flex-1 ${primaryButton("lg")} ${lending ? "opacity-60 cursor-wait" : ""} disabled:opacity-60`}
        >
          {lending ? "Lending…" : "Lend it"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className={quietButton("lg")}
        >
          Cancel
        </button>
      </div>
      {sorted.length === 0 ? (
        <p className="text-xs text-stone-500 dark:text-stone-400">
          Or{" "}
          <Link to="/friends/add" className="underline underline-offset-2">
            find friends on Stacks
          </Link>{" "}
          to lend to them in one tap.
        </p>
      ) : null}
    </Form>
  );
}

type BookData = LoaderData<typeof loader>;

// A few facts beside the cover: where the book is, when it arrived, how
// often it's been lent
function BookFacts({ data }: { data: BookData }) {
  const { book } = data;
  const rows: [string, React.ReactNode][] = [];

  // Where it is shows in the label under the cover for the owner, and
  // "Available" goes without saying beside Ask to borrow
  if (!data.isOwner && !data.isBorrower && book.borrower) {
    // When to expect it back, while that's still ahead: a late one is
    // between its owner and borrower
    const due = book.dueDate && daysUntil(book.dueDate) >= 0 ? dueText(book.dueDate) : null;
    rows.push(["Status", due ? `Out on loan, ${due}` : "Out on loan"]);
  }
  if (rows.length === 0 && data.waiting.length === 0) return null;

  return (
    <>
      {rows.length > 0 ? (
        // Short labels in a narrow column, values right beside them
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-stone-500 dark:text-stone-400">{label}</dt>
              <dd className="text-stone-800 dark:text-stone-200">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {data.waiting.length > 0 ? <WaitingLine data={data} /> : null}
    </>
  );
}

// "2 days", "3 weeks": how long someone's been in line
function waitedFor(since: string | Date) {
  const days = Math.floor(
    (Date.now() - new Date(since).getTime()) / 86_400_000,
  );
  if (days < 1) return "today";
  if (days < 14) return `${days} ${days === 1 ? "day" : "days"}`;
  return `${Math.floor(days / 7)} weeks`;
}

// Who's waiting for this copy, in order, for the owner and the borrower
function WaitingLine({ data }: { data: BookData }) {
  const { waiting, book } = data;
  const next = waiting[0];
  return (
    <section
      aria-label="Waiting in line"
      className="rounded-lg border border-stone-200 dark:border-stone-800 text-sm"
    >
      <p className="flex items-baseline justify-between border-b border-stone-100 dark:border-stone-800 px-3 py-2 font-medium text-stone-700 dark:text-stone-300">
        In line for it
        <span className="font-normal text-stone-400 dark:text-stone-500">
          {waiting.length}
        </span>
      </p>
      <ol className="space-y-2 px-3 py-2.5">
        {waiting.map((person, index) => (
          <li key={person.id} className="flex items-center gap-2.5">
            <span className="w-4 flex-shrink-0 text-center text-xs tabular-nums text-stone-400 dark:text-stone-500">
              {index + 1}
            </span>
            <Avatar
              firstname={person.firstname}
              surname={person.surname}
              icon={person.profileEmoji}
              size="xs"
            />
            <span className="min-w-0 flex-1 truncate text-stone-800 dark:text-stone-200">
              <PersonLink
                id={person.id}
                name={person.firstname}
                friendIds={data.friendIds}
              />
            </span>
            <span className="flex-shrink-0 text-xs text-stone-400 dark:text-stone-500">
              {waitedFor(person.since)}
            </span>
          </li>
        ))}
      </ol>
      <p className="border-t border-stone-100 dark:border-stone-800 px-3 py-2 text-xs text-stone-500 dark:text-stone-400">
        {data.isBorrower
          ? `${next.firstname} is next after you.`
          : book.borrower
            ? `When it's back, ${next.firstname} is next.`
            : `${next.firstname} is next.`}
      </p>
    </section>
  );
}

// Covers Open Library has for this book, to choose from instead of
// pasting a URL. Loads only when asked for.
function CoverPicker({
  bookId,
  selected,
  onPick,
}: {
  bookId: string;
  selected: string;
  onPick: (url: string) => void;
}) {
  const fetcher = useFetcher<{ covers: CoversResponse; failed?: boolean }>({
    key: `covers-${bookId}`,
  });
  const covers = fetcher.data?.covers;
  const failed = fetcher.data?.failed === true;
  const loading = fetcher.state !== "idle";

  if (!covers || failed) {
    return (
      <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
        {failed && !loading ? "Open Library didn't answer. " : null}
        <button
          type="button"
          disabled={loading}
          onClick={() => fetcher.load(`/api/covers?bookId=${bookId}`)}
          className="text-stone-700 dark:text-stone-200 underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:underline disabled:opacity-60"
        >
          {loading
            ? "Looking on Open Library, which can take a few seconds…"
            : failed
              ? "Try again"
              : "Or pick a cover from Open Library"}
        </button>
      </p>
    );
  }
  if (covers.length === 0) {
    return (
      <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
        Open Library has no covers for this book.
      </p>
    );
  }
  return (
    <ul
      className="mt-3 flex flex-wrap gap-2"
      aria-label="Covers on Open Library"
    >
      {covers.map((cover) => {
        const picked = selected === cover.full;
        return (
          <li key={cover.id}>
            <button
              type="button"
              onClick={() => onPick(cover.full)}
              aria-pressed={picked}
              className={`block h-24 w-16 overflow-hidden rounded-xs bg-stone-100 dark:bg-stone-800 transition-shadow ${
                picked
                  ? "ring-2 ring-stone-900 dark:ring-stone-100"
                  : "ring-1 ring-stone-900/10 dark:ring-white/10 hover:ring-stone-400"
              }`}
            >
              <img
                src={cover.thumb}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// The loan that's out right now, as the top entry of your copy's lending
// history: who, until when, and what you can do about it, each choice
// under a line saying what it's for
function LoanCard({ data }: { data: BookData }) {
  const reminder = useFetcher<{ reminderSent?: boolean }>();
  const extend = useFetcher<{ loanExtended?: boolean }>();
  const returned = useFetcher();
  const borrower = data.book.borrower;
  if (!borrower) return null;

  const due = data.book.dueDate ? new Date(data.book.dueDate) : null;
  const daysLeft = due
    ? Math.ceil((due.getTime() - Date.now()) / 86_400_000)
    : null;
  const overdue = daysLeft !== null && daysLeft < 0;
  const status =
    daysLeft === null
      ? null
      : overdue
        ? `${-daysLeft} ${daysLeft === -1 ? "day" : "days"} late`
        : daysLeft === 0
          ? "Due today"
          : daysLeft === 1
            ? "Due tomorrow"
            : daysLeft < 14
              ? `Due in ${daysLeft} days`
              : `Due in ${Math.round(daysLeft / 7)} weeks`;
  const reminderSent = reminder.data?.reminderSent === true;
  const sendingReminder = reminder.state !== "idle";
  // The answer comes back too fast to show "Extending…" without a flicker;
  // the new due date, said once it's in, is the better sign. It stays put
  // through later clicks, in a line that holds its room from the start.
  const extended = extend.data?.loanExtended === true;
  const name = borrower.firstname;
  const label = "text-sm text-stone-500 dark:text-stone-400";
  const chip = `flex-shrink-0 rounded-full bg-stone-100 dark:bg-stone-800 px-2.5 py-0.5 text-xs ${
    overdue
      ? "font-semibold text-stone-900 dark:text-stone-100"
      : "text-stone-500 dark:text-stone-400"
  }`;
  const button =
    "rounded-md border border-stone-200 dark:border-stone-700 px-2 py-1.5 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors";
  const divider = "border-t border-stone-100 dark:border-stone-800";

  return (
    <div
      className={`rounded-xl border border-stone-200 dark:border-stone-800 text-sm transition-opacity ${
        returned.state !== "idle" ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-3 p-4 sm:items-center">
        <Avatar
          firstname={borrower.firstname}
          surname={borrower.surname}
          icon={borrower.profileEmoji}
        />
        <div className="min-w-0 flex-1">
          <p className="text-base text-stone-900 dark:text-stone-100">
            <span className="font-semibold">
              <PersonLink
                id={borrower.id}
                name={`${borrower.firstname} ${borrower.surname}`}
                friendIds={data.friendIds}
              />
            </span>{" "}
            has your copy
          </p>
          <p className="text-stone-500 dark:text-stone-400">
            {[
              data.book.borrowedAt
                ? `Since ${monthDay(data.book.borrowedAt)}`
                : null,
              due ? `due ${monthDay(due)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {/* On phones the status goes under the dates, leaving the name room */}
          {status ? (
            <span className={`mt-2 inline-flex sm:hidden ${chip}`}>
              {status}
            </span>
          ) : null}
        </div>
        {status ? (
          <span className={`hidden sm:inline-flex ${chip}`}>{status}</span>
        ) : null}
      </div>

      {/* Two unrelated choices side by side, so a line between them */}
      <div
        className={`grid gap-5 p-4 sm:grid-cols-2 sm:gap-0 sm:divide-x sm:divide-stone-100 sm:dark:divide-stone-800 ${divider}`}
      >
        <div className="sm:pr-5">
          <p className={label}>Give {name} more time</p>
          <extend.Form method="post" className="mt-2 flex gap-1.5">
            <input type="hidden" name="intent" value="extendLoan" />
            {data.extendWeeks.map((weeks) => (
              <button
                key={weeks}
                type="submit"
                name="weeks"
                value={weeks}
                disabled={extend.state !== "idle"}
                className={`flex-1 whitespace-nowrap ${button} disabled:opacity-60`}
              >
                +{weeks} {weeks === 1 ? "week" : "weeks"}
              </button>
            ))}
          </extend.Form>
          <p
            role="status"
            className="mt-2 min-h-4 text-xs text-stone-500 dark:text-stone-400"
          >
            {extended && due
              ? `Now due ${monthDay(due)}.${borrower.nameOnly ? "" : ` ${name} has been told.`}`
              : ""}
          </p>
        </div>
        {/* Someone lent to by name can't be reached here; their reminders
            come to the owner instead */}
        {borrower.nameOnly ? (
          <div className="sm:pl-5">
            <p className={label}>Lent by name</p>
            <p className="mt-2 text-stone-500 dark:text-stone-400">
              {name} isn&apos;t on Stacks, so reminders come to you when
              it&apos;s nearly due and if it&apos;s late.
            </p>
          </div>
        ) : (
          <div className="sm:pl-5">
            <p className={label}>
              {overdue
                ? `Ask ${name} to bring it back`
                : `Remind ${name} it's due`}
            </p>
            <reminder.Form method="post" className="mt-2">
              <input type="hidden" name="intent" value="sendReminder" />
              <button
                type="submit"
                disabled={sendingReminder || reminderSent}
                // The one thing to do on a loan, so it's the green button
                className={`w-full ${reminderSent ? quietLabel : primaryButton("lg")} py-1.5 disabled:cursor-default`}
              >
                {reminderSent
                  ? "Reminder sent"
                  : sendingReminder
                    ? "Sending…"
                    : "Send a reminder"}
              </button>
            </reminder.Form>
          </div>
        )}
      </div>

      <div
        className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 ${divider}`}
      >
        <p className="text-stone-500 dark:text-stone-400">
          Got it back in person?
        </p>
        <returned.Form
          method="post"
          onSubmit={(event) => {
            if (!confirm(`Mark ${data.book.title} as returned?`))
              event.preventDefault();
          }}
        >
          <input type="hidden" name="intent" value="markReturned" />
          <button
            type="submit"
            className="text-stone-700 dark:text-stone-200 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:decoration-stone-500"
          >
            Mark as returned
          </button>
        </returned.Form>
      </div>
    </div>
  );
}

// When the copy that's out is due back. The owner and the borrower are
// told if it's late; anyone else just sees that someone has it.
function CurrentLoan({ data }: { data: BookData }) {
  const due = data.book.dueDate;
  if (!due) return <>has it now</>;
  const late = new Date(due) < new Date();
  if (data.isOwner || data.isBorrower) {
    return late ? (
      <span className="font-semibold text-stone-900 dark:text-stone-100">
        overdue since {monthDay(due)}
      </span>
    ) : (
      <>due {monthDay(due)}</>
    );
  }
  return late ? <>has it now</> : <>due back {monthDay(due)}</>;
}

// For the owner, on the latest return: it was marked returned (by them or
// the borrower) but never actually came back, so the loan carries on
function NotBack({ title, name }: { title: string; name: string }) {
  const undo = useFetcher();
  return (
    <undo.Form
      method="post"
      className="inline"
      onSubmit={(event) => {
        if (
          !confirm(
            `${title} isn't back yet? It goes back on ${name}'s loans, due when it was.`,
          )
        )
          event.preventDefault();
      }}
    >
      <input type="hidden" name="intent" value="undoReturn" />
      <button
        type="submit"
        disabled={undo.state !== "idle"}
        className="underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-800 dark:hover:text-stone-200 hover:decoration-stone-500 disabled:opacity-60"
      >
        Not back yet?
      </button>
    </undo.Form>
  );
}

// Everyone who has had this copy, newest first, down to the day it
// joined the owner's shelf
function LendingHistory({ data }: { data: BookData }) {
  const {
    book,
    currentUser,
    lendingHistory: entries,
    isOwner,
    isFriend,
  } = data;
  const owner = book.user;
  const ownerPerson = book.userId === currentUser?.id ? currentUser : owner;
  const lendCount = book.lendCount;
  const ownerLink = (text: string) =>
    isFriend && owner ? (
      <Link
        to={`/friend/${owner.id}`}
        className="underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:underline"
      >
        {text}
      </Link>
    ) : owner?.shareToken ? (
      <Link
        to={`/share/${owner.shareToken}`}
        className="underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:underline"
      >
        {text}
      </Link>
    ) : (
      text
    );
  return (
    <div>
      <h2 className={`${sectionHeading} mb-2`}>
        Lending history
        <span className="ml-2 text-sm font-normal text-stone-400 dark:text-stone-500">
          {lendCount === 0
            ? "not lent yet"
            : `lent ${lendCount} ${lendCount === 1 ? "time" : "times"}`}
        </span>
      </h2>
      <ul className="space-y-3">
        {entries.map((entry) => {
          if (
            !entry.returnedAt &&
            isOwner &&
            book.borrower?.id === entry.borrower.id
          ) {
            return (
              <li key={entry.id}>
                <LoanCard data={data} />
              </li>
            );
          }
          const person =
            entry.isCurrentUser && currentUser ? currentUser : entry.borrower;
          const name = `${entry.borrower.firstname} ${entry.borrower.surname}`;
          return (
            <li
              key={entry.id}
              className="flex items-center gap-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 px-4 py-3"
            >
              <Avatar
                firstname={person.firstname}
                surname={person.surname}
                icon={person.profileEmoji}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-stone-900 dark:text-stone-100">
                  {entry.isCurrentUser ? (
                    "You"
                  ) : entry.isFriend ? (
                    <Link
                      to={`/friend/${entry.borrower.id}`}
                      className="underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:underline"
                    >
                      {name}
                    </Link>
                  ) : entry.borrower.shareToken ? (
                    <Link
                      to={`/share/${entry.borrower.shareToken}`}
                      className="underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:underline"
                    >
                      {name}
                    </Link>
                  ) : (
                    name
                  )}
                </p>
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  {entry.returnedAt ? (
                    <>
                      {monthDay(entry.borrowedAt)} –{" "}
                      {monthDay(entry.returnedAt)}
                      {entry.id === data.undoableReturnId ? (
                        <>
                          {" · "}
                          <NotBack
                            title={book.title}
                            name={entry.borrower.firstname}
                          />
                        </>
                      ) : null}
                    </>
                  ) : (
                    <>
                      Since {monthDay(entry.borrowedAt)} ·{" "}
                      <CurrentLoan data={data} />
                    </>
                  )}
                </p>
              </div>
            </li>
          );
        })}
        {ownerPerson ? (
          <li className="flex items-center gap-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-950 px-4 py-3">
            <Avatar
              firstname={ownerPerson.firstname}
              surname={ownerPerson.surname}
              icon={isOwner ? (currentUser?.profileEmoji ?? null) : null}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-stone-900 dark:text-stone-100">
                {book.userId === currentUser?.id
                  ? "You"
                  : isOwner
                    ? `${ownerPerson.firstname} ${ownerPerson.surname}`
                    : ownerLink(
                        `${ownerPerson.firstname} ${ownerPerson.surname}`,
                      )}
              </p>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Added to {isOwner ? "your" : "their"} shelf ·{" "}
                {monthDay(book.createdAt)}
              </p>
            </div>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

export default function BookDetailsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as {
    success?: boolean;
    refreshed?: boolean;
    friendRequestSent?: boolean;
    reminderSent?: boolean;
    // The pasted cover link couldn't be fetched
    coverError?: string;
    edited?: boolean;
    message?: string;
  } | null;
  const navigation = useNavigation();
  const [isEditing, setIsEditing] = useState(false);
  // The lending form, opened from its button or from the bar on phones.
  // It starts closed again once the book's out.
  const [lendOpen, setLendOpen] = useState(false);
  const borrowerId = data.book.borrower?.id;
  useEffect(() => {
    if (borrowerId) setLendOpen(false);
  }, [borrowerId]);
  // The book's main action, which the bar on phones stands in for once
  // it's scrolled away
  const actionRef = useRef<HTMLDivElement>(null);

  // A book seen for the first time finishes its look-up on Open Library
  // after the page is up; the page reloads its data when that's done. A
  // plain fetch, since a fetcher started this early in hydration can be
  // dropped.
  const { revalidate } = useRevalidator();
  const askedFor = useRef<string | null>(null);
  // The look-up that came back empty-handed; its placeholders go away
  const [gaveUp, setGaveUp] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!data.fillingIn || askedFor.current === data.book.id) return;
    const id = data.book.id;
    askedFor.current = id;
    let done = false;
    fetch(`/api/book-details?bookId=${encodeURIComponent(id)}`)
      .then((response) => (response.ok ? response.json() : { done: false }))
      .then((result: { done?: boolean }) => {
        // Still on this book: show what was found
        done = result.done === true;
        if (mounted.current && askedFor.current === id && done) revalidate();
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted.current && askedFor.current === id && !done) setGaveUp(id);
      });
  }, [data.fillingIn, data.book.id, revalidate]);
  // Until it's in, what's to come keeps its place on the page. From the
  // server's render on, so the first paint already has the room.
  const lookingUp = data.fillingIn && gaveUp !== data.book.id && !isEditing;
  // Whether this visit waited for Open Library, so what it brought fades
  // in rather than popping
  const [waitedForDetails, setWaitedForDetails] = useState(false);
  useEffect(() => {
    if (lookingUp) setWaitedForDetails(true);
  }, [lookingUp]);
  // The cover field is controlled so the picker below it can fill it in
  const [cover, setCover] = useState(data.book.cover);

  const isSubmitting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "request";
  const isRefreshing =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "refresh";
  const isSendingFriendRequest =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "friendRequest";
  const isSaving =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "edit";
  const requestSent = actionData?.success === true;
  const friendRequestSent = actionData?.friendRequestSent === true;
  const refreshResult = actionData?.refreshed !== undefined ? actionData : null;

  // Close edit mode after successful save
  useEffect(() => {
    if (actionData?.edited && navigation.state === "idle") {
      setIsEditing(false);
    }
  }, [actionData?.edited, navigation.state]);

  // Its owner isn't lending it for now: no asking, no waiting
  const notLending = isNotLending(data.book.notLendingUntil);
  const canRequestBook =
    !data.isOwner &&
    !data.isBorrowed &&
    !data.isBorrower &&
    data.isFriend &&
    !notLending;
  const needsFriendship = !data.isOwner && !data.isFriend;
  // A friend's book someone else has right now: you can wait for it
  const canWaitInLine =
    !data.isOwner &&
    data.isBorrowed &&
    !data.isBorrower &&
    data.isFriend &&
    !notLending;
  const showNotLending =
    !data.isOwner && !data.isBorrower && data.isFriend && notLending;
  const lendsAgainOn = lendingAgainOn(data.book.notLendingUntil);
  // One quiet line: the year, the length and what it's about, the subjects
  // as plain words. The publisher stays under Edit details; up here it
  // crowded the title.
  const subjects = cleanSubjects(data.book.subjects);
  const details = [
    data.book.datePublished,
    data.book.pageCount ? `${data.book.pageCount} pages` : null,
    subjects.join(", "),
  ].filter(Boolean);

  // Title and details: beside the cover on phones, in the main column on
  // larger screens
  const heading = (
    <>
      <h1 className="text-2xl md:text-4xl font-semibold tracking-tight leading-tight text-stone-900 dark:text-stone-100">
        {data.book.title}
      </h1>
      <p className="mt-1 md:text-xl text-stone-500 dark:text-stone-400">
        {/* More by them, from Open Library */}
        {data.book.author ? (
          <Link
            to={`/search?${new URLSearchParams({ q: data.book.author, type: "author" })}`}
            title={`More books by ${data.book.author}`}
            className="underline-offset-4 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-800 dark:hover:text-stone-200 hover:underline"
          >
            {data.book.author}
          </Link>
        ) : null}
      </p>

      {details.length > 0 ? (
        <p className="mt-3 md:mt-4 text-sm text-stone-500 dark:text-stone-400">
          {details.join(" · ")}
        </p>
      ) : lookingUp ? (
        <Placeholder className="mt-3 md:mt-4 w-48 max-w-full text-sm" />
      ) : null}
    </>
  );

  return (
    <>
      <main className="flex flex-col md:flex-row gap-6 md:gap-12 lg:gap-16 xl:gap-20 px-4 md:px-8 py-8 md:py-12 w-full">
        {/* The cover stays in view while the page scrolls, on screens tall
            enough to hold it with the lending form open below the header */}
        <section className="flex-shrink-0 md:w-[200px] lg:w-[240px] space-y-4 md:self-start md:[@media(min-height:45rem)]:sticky md:[@media(min-height:45rem)]:top-20">
          <div className="flex items-start gap-4">
            <BookCover
              src={data.book.cover}
              title={data.book.title}
              author={data.book.author}
              // Straight to the cover part of the form
              onAddCover={
                data.isOwner && !isEditing
                  ? () => {
                      setIsEditing(true);
                      requestAnimationFrame(() =>
                        document
                          .getElementById("cover")
                          ?.scrollIntoView({ block: "center" }),
                      );
                    }
                  : undefined
              }
              // Saving a cover pasted from another site downloads it first,
              // which takes a few seconds
              fetching={Boolean(
                isSaving &&
                navigation.formData?.get("cover") !== data.book.cover,
              )}
            />
            {!isEditing ? (
              <div className="md:hidden min-w-0 flex-1 [overflow-wrap:anywhere]">
                {heading}
              </div>
            ) : null}
          </div>
          {/* Your own copy while it's out: who has it, taking you down to the
              loan in the lending history. On your shelf, Lend this book
              says enough. */}
          {data.isOwner && !isEditing && data.book.borrower ? (
            <a
              href="#lending"
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-700 px-4 py-2 text-sm text-stone-600 dark:text-stone-300 hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
            >
              <LentIcon
                size={14}
                className="text-stone-400 dark:text-stone-500"
              />
              Lent to {data.book.borrower.firstname}
            </a>
          ) : null}
          {/* Lent by email to someone who hasn't joined, or by name only */}
          {data.isOwner && !isEditing && data.book.borrower?.invitedAt ? (
            <p className="text-center text-xs text-stone-500 dark:text-stone-400">
              Not on Stacks yet. We emailed them.
            </p>
          ) : null}
          {data.isOwner && !isEditing && data.book.borrower?.nameOnly ? (
            <p className="text-center text-xs text-stone-500 dark:text-stone-400">
              Lent by name. Reminders come to you.
            </p>
          ) : null}
          {data.isOwner && !isEditing && !data.book.borrower ? (
            <div ref={actionRef}>
              <LendToFriend
                friends={[...(data.currentUser?.following ?? []), ...data.lentByName]}
                loanChoices={data.loanChoices}
                byEmail={
                  data.currentUser?.demoGroup
                    ? "off"
                    : data.currentUser?.emailVerifiedAt
                      ? "ok"
                      : "confirm-email"
                }
                open={lendOpen}
                onOpen={() => setLendOpen(true)}
                onClose={() => setLendOpen(false)}
              />
            </div>
          ) : null}
          {data.isOwner && !isEditing ? (
            <NotLendingNotice until={data.book.notLendingUntil} />
          ) : null}
          {/* Added by mistake: back to the list in one tap, for a copy
              that's never been lent, so no one's History loses it */}
          {data.book.userId === data.currentUser?.id && !isEditing && !data.book.borrower && data.lendingHistory.length === 0 ? (
            <Form method="post" className="text-center">
              <input type="hidden" name="intent" value="moveToWant" />
              <button
                type="submit"
                className="text-xs text-stone-500 dark:text-stone-400 underline-offset-2 hover:underline hover:text-stone-800 dark:hover:text-stone-200"
              >
                Don&apos;t own it? Move to Want to read
              </button>
            </Form>
          ) : null}
          {showNotLending ? (
            <p className={`block text-center ${quietLabel}`}>
              {lendsAgainOn
                ? `Not lending until ${monthDay(lendsAgainOn)}`
                : "Not lending right now"}
            </p>
          ) : null}
          {canRequestBook ? (
            <div ref={actionRef}>
              <Form method="post" className="space-y-2">
                <input type="hidden" name="intent" value="request" />
                {/* A word for the owner goes with the ask: when, how long, where */}
                {requestSent ? null : (
                  <>
                    <label htmlFor="request-message" className="sr-only">
                      A note for {data.book.user?.firstname ?? "the owner"}
                    </label>
                    <textarea
                      id="request-message"
                      name="message"
                      // One line until the note needs more, then it grows
                      // with it (up to a few lines, then it scrolls)
                      rows={1}
                      onInput={(event) => {
                        const box = event.currentTarget;
                        box.style.height = "auto";
                        box.style.height = `${box.scrollHeight + box.offsetHeight - box.clientHeight}px`;
                      }}
                      maxLength={REQUEST_NOTE_MAX}
                      // No name in the hint, so it stays on one line in the
                      // narrow column whatever the owner is called; the label
                      // names them
                      placeholder="A note: when, and for how long?"
                      className="block max-h-40 w-full resize-none overflow-y-auto rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-sm leading-relaxed text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10"
                    />
                  </>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting || requestSent}
                  className={`w-full ${
                    requestSent
                      ? quietLabel
                      : isSubmitting
                        ? `${primaryButton("lg")} opacity-60 cursor-wait`
                        : primaryButton("lg")
                  }`}
                >
                  {requestSent
                    ? "Request sent"
                    : isSubmitting
                      ? "Asking…"
                      : "Ask to borrow"}
                </button>
              </Form>
            </div>
          ) : null}
          {canWaitInLine && !isEditing ? (
            <WaitInLine position={data.linePosition} />
          ) : null}
          {needsFriendship && data.book.user ? (
            <div className={panel}>
              <p className="text-stone-600 dark:text-stone-300 mb-3">
                Add{" "}
                <span className="font-semibold text-stone-900 dark:text-stone-100">
                  {data.book.user.firstname} {data.book.user.surname}
                </span>{" "}
                as a friend to borrow their books.
              </p>
              <Form method="post">
                <input type="hidden" name="intent" value="friendRequest" />
                <button
                  type="submit"
                  disabled={isSendingFriendRequest || friendRequestSent}
                  className={`w-full ${
                    friendRequestSent
                      ? quietLabel
                      : isSendingFriendRequest
                        ? `${primaryButton("lg")} opacity-60 cursor-wait`
                        : primaryButton("lg")
                  }`}
                >
                  {friendRequestSent
                    ? "Friend request sent"
                    : isSendingFriendRequest
                      ? "Sending…"
                      : "Add friend"}
                </button>
              </Form>
            </div>
          ) : null}
          {/* What the lender said when they agreed: where, when */}
          {data.isBorrower && data.loanReply?.message ? (
            <figure className="rounded-md border border-stone-200 dark:border-stone-700 px-3 py-2.5 text-sm">
              <blockquote className="italic text-stone-700 dark:text-stone-200">
                “{data.loanReply.message}”
              </blockquote>
              <figcaption className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                {data.loanReply.senderName.split(" ")[0]}, when they said yes
              </figcaption>
            </figure>
          ) : null}
          {/* Whose it is and when it's due are in the lending history */}
          {data.isBorrower ? (
            <Form method="post">
              <input type="hidden" name="intent" value="return" />
              <button type="submit" className={`w-full ${quietButton("lg")}`}>
                {data.book.user
                  ? `Return book to ${data.book.user.firstname}`
                  : "Return book"}
              </button>
            </Form>
          ) : null}
          {/* Someone's waiting: hand it straight on, as a book club does */}
          {data.isBorrower &&
          data.waiting.length > 0 &&
          !isNotLending(data.book.notLendingUntil) ? (
            <Form method="post">
              <input type="hidden" name="intent" value="passOn" />
              <button type="submit" className={`w-full ${quietButton("lg")}`}>
                Pass it to {data.waiting[0].firstname}
              </button>
              <p className="mt-1.5 text-xs text-stone-500 dark:text-stone-400">
                {data.waiting[0].firstname} is next in line. Hand it over and
                it&apos;s theirs for {data.loanChoices.defaultWeeks} weeks;
                {data.book.user ? ` ${data.book.user.firstname}` : " its owner"}{" "}
                hears where it went.
              </p>
            </Form>
          ) : null}
          {!isEditing ? <BookFacts data={data} /> : null}
        </section>
        <section className="relative flex-1 min-w-0">
          {isEditing ? (
            /* Edit Mode */
            <div>
              <h2 className="text-xl font-semibold text-stone-900 dark:text-stone-100 mb-6">
                Edit book
              </h2>
              <Form method="post" className="space-y-5">
                <input type="hidden" name="intent" value="edit" />

                <div>
                  <label htmlFor="title" className={labelClass}>
                    Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    defaultValue={data.book.title}
                    className={textField}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="author" className={labelClass}>
                    Author
                  </label>
                  <input
                    type="text"
                    id="author"
                    name="author"
                    defaultValue={data.book.author}
                    className={textField}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="body" className={labelClass}>
                    Description
                  </label>
                  <textarea
                    id="body"
                    name="body"
                    rows={5}
                    defaultValue={data.book.body}
                    className={`${textField} leading-relaxed`}
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_2fr] gap-4">
                  <div>
                    <label htmlFor="datePublished" className={labelClass}>
                      Year
                    </label>
                    <input
                      type="text"
                      id="datePublished"
                      name="datePublished"
                      defaultValue={data.book.datePublished || ""}
                      placeholder="1984"
                      inputMode="numeric"
                      className={textField}
                    />
                  </div>
                  <div>
                    <label htmlFor="pageCount" className={labelClass}>
                      Pages
                    </label>
                    <input
                      type="number"
                      id="pageCount"
                      name="pageCount"
                      defaultValue={data.book.pageCount || ""}
                      className={textField}
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label htmlFor="publisher" className={labelClass}>
                      Publisher
                    </label>
                    <input
                      type="text"
                      id="publisher"
                      name="publisher"
                      defaultValue={data.book.publisher || ""}
                      className={textField}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="subjects" className={labelClass}>
                    Subjects
                  </label>
                  <input
                    type="text"
                    id="subjects"
                    name="subjects"
                    defaultValue={data.book.subjects || ""}
                    placeholder="Fiction, Adventure, Classic"
                    className={textField}
                  />
                  <p className="mt-1.5 text-xs text-stone-400 dark:text-stone-500">
                    Separate with commas.
                  </p>
                </div>
                <div>
                  <label htmlFor="cover" className={labelClass}>
                    Cover image URL
                  </label>
                  <input
                    type="url"
                    id="cover"
                    name="cover"
                    value={cover}
                    onChange={(event) => setCover(event.target.value)}
                    placeholder="https://covers.openlibrary.org/..."
                    className={textField}
                  />
                  <p className="mt-1.5 text-xs text-stone-400 dark:text-stone-500">
                    {/* The full list of sites is in the message if one is
                        turned down */}
                    An image link from Open Library, Amazon, Goodreads or
                    another book site, under 5 MB.
                  </p>
                  {actionData?.coverError ? (
                    <p
                      role="alert"
                      className="mt-1.5 text-sm text-red-700 dark:text-red-400"
                    >
                      {actionData.coverError}
                    </p>
                  ) : null}
                  <CoverPicker
                    bookId={data.book.id}
                    selected={cover}
                    onPick={setCover}
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className={`${primaryButton("lg")} ${isSaving ? "opacity-60 cursor-wait" : ""}`}
                  >
                    {isSaving ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className={quietButton("lg")}
                  >
                    Cancel
                  </button>
                </div>
              </Form>

              {/* Kept outside the edit form: forms can't nest */}
              <div className="mt-10 border-t border-stone-100 dark:border-stone-800 pt-6 space-y-5">
                <NotLendingSetting until={data.book.notLendingUntil} />

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium text-stone-800 dark:text-stone-200">
                      Refresh from Open Library
                    </p>
                    <p className="text-stone-500 dark:text-stone-400">
                      Fill in the year, pages, publisher, subjects and
                      description.
                      {data.book.openLibraryKey ? (
                        <>
                          {" "}
                          <a
                            href={`https://openlibrary.org${data.book.openLibraryKey}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline underline-offset-2 hover:text-stone-800 dark:hover:text-stone-200"
                          >
                            View on Open Library
                          </a>
                        </>
                      ) : null}
                    </p>
                    {data.book.openLibraryKey ? (
                      // Open Library is a wiki: a fix made there is a fix for
                      // everyone who adds the book after
                      <p className="mt-1 text-stone-500 dark:text-stone-400">
                        Something wrong at the source?{" "}
                        <a
                          href={`https://openlibrary.org${data.book.openLibraryKey}/edit`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2 hover:text-stone-800 dark:hover:text-stone-200"
                        >
                          Fix it on Open Library
                        </a>
                        , then refresh.
                      </p>
                    ) : null}
                    {refreshResult ? (
                      <p className="mt-1 text-stone-800 dark:text-stone-200">
                        {refreshResult.message}
                      </p>
                    ) : null}
                  </div>
                  <Form method="post" className="flex-shrink-0">
                    <input type="hidden" name="intent" value="refresh" />
                    <button
                      type="submit"
                      disabled={isRefreshing}
                      className={`${quietButton("lg")} ${isRefreshing ? "opacity-60 cursor-wait" : ""}`}
                    >
                      {isRefreshing ? "Refreshing…" : "Refresh"}
                    </button>
                  </Form>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-sm">
                    <p className="font-medium text-stone-800 dark:text-stone-200">
                      Delete this book
                    </p>
                    <p className="text-stone-500 dark:text-stone-400">
                      Removes it from your shelf for good.
                    </p>
                  </div>
                  <Form
                    method="post"
                    className="flex-shrink-0"
                    onSubmit={(event) => {
                      if (
                        !confirm(`Delete ${data.book.title} from your shelf?`)
                      ) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="intent" value="delete" />
                    <button
                      type="submit"
                      className={`${quietButton("lg")} hover:bg-stone-900 hover:text-white hover:border-stone-900 dark:hover:bg-stone-100 dark:hover:text-stone-900`}
                    >
                      Delete
                    </button>
                  </Form>
                </div>
              </div>
            </div>
          ) : (
            /* View Mode */
            <>
              <div className="hidden md:block">{heading}</div>
            </>
          )}

          {/* The opening line, the description and the author arrive as
              one: while Open Library is asked, all three wait as
              placeholders (even a description we already have), so the
              page fills in once instead of piece by piece */}
          {lookingUp ? (
            <div>
              <p role="status" className="sr-only">
                Looking up more about this book on Open Library…
              </p>
              <Placeholder
                lines={2}
                className={`mt-10 ${openingLineType} max-w-prose`}
              />
              <Placeholder lines={3} className="mt-8 max-w-prose" />
              <Placeholder lines={3} className="mt-8 max-w-prose" />
            </div>
          ) : null}

          {!isEditing && !lookingUp ? (
            <div
              className={
                waitedForDetails ? "motion-safe:animate-fade-in" : undefined
              }
            >
              {data.book.firstSentence ? (
                <OpeningLine sentence={data.book.firstSentence} />
              ) : null}

              <div className="mt-8">
                {/* Unlabeled, like a jacket's blurb; About the author keeps
                    its label */}
                <h2 className="sr-only">About this book</h2>
                <p className="whitespace-pre-wrap text-stone-700 dark:text-stone-300 leading-relaxed max-w-prose">
                  {data.book.body ? (
                    stripMarkdown(data.book.body)
                  ) : data.isOwner ? (
                    <>
                      No description yet.{" "}
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className={gapLink}
                      >
                        Add one
                      </button>
                      , or refresh from Open Library.
                    </>
                  ) : (
                    "No description yet."
                  )}
                </p>
              </div>

              {/* Only with something to say: a heading over a bare link
                  read like something broke */}
              {data.author?.bio ? (
                <AboutAuthor author={data.author} />
              ) : null}
            </div>
          ) : null}

          {!isEditing ? (
            <ReaderNotes
              notes={data.readerNotes}
              myNote={data.myNote}
              canNote={data.canNote}
              maxLength={data.noteMaxLength}
              friendIds={data.friendIds}
              readAt={data.readAt}
            />
          ) : null}

          {!isEditing ? (
            <div id="lending" className="mt-10">
              <LendingHistory data={data} />
            </div>
          ) : null}

          {/* Rarely needed, so they wait at the very bottom: fixing the
              details, and this book's place on your public page */}
          {!isEditing && (data.isOwner || data.page) ? (
            <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2">
              {data.isOwner ? (
                <button
                  type="button"
                  // The form opens at the top, so the page goes back up
                  onClick={() => {
                    setIsEditing(true);
                    window.scrollTo({ top: 0 });
                  }}
                  className="inline-flex items-center gap-1.5 text-sm text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                >
                  <PencilIcon size={14} />
                  <span className="underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600">
                    Edit details or cover
                  </span>
                </button>
              ) : null}
              {data.page ? <PinToggle page={data.page} /> : null}
              {data.page ? <HideToggle page={data.page} /> : null}
            </div>
          ) : null}
        </section>
      </main>

      {/* On phones, the main action follows you down the page */}
      {data.isOwner && !isEditing && !data.book.borrower ? (
        <ActionBar
          target={actionRef}
          label="Lend this book"
          className={quietButton("lg")}
          onClick={() => setLendOpen(true)}
        />
      ) : canRequestBook && !requestSent ? (
        <ActionBar
          target={actionRef}
          label="Ask to borrow"
          className={primaryButton("lg")}
        />
      ) : null}
    </>
  );
}

// A bar along the bottom of a phone's screen that stands in for the main
// action once it's scrolled off the top. Tapping it goes back up to the
// real one (opening it, for lending), so there's one form, not two.
function ActionBar({
  target,
  label,
  className,
  onClick,
}: {
  target: React.RefObject<HTMLElement | null>;
  label: string;
  className: string;
  onClick?: () => void;
}) {
  const [away, setAway] = useState(false);
  const [atFooter, setAtFooter] = useState(false);
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    // Away only once it's above the screen (or under the sticky header),
    // not before it's reached
    const observer = new IntersectionObserver(
      ([entry]) =>
        setAway(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: "-56px 0px 0px 0px" },
    );
    observer.observe(element);
    // And out of the way of the site's footer at the very end, once it's
    // well onto the screen rather than just peeking in at the bottom
    const footer = document.querySelector("footer");
    const footerObserver = new IntersectionObserver(
      ([entry]) => setAtFooter(entry.isIntersecting),
      { rootMargin: "0px 0px -30% 0px" },
    );
    if (footer) footerObserver.observe(footer);
    return () => {
      observer.disconnect();
      footerObserver.disconnect();
    };
  }, [target]);
  const shown = away && !atFooter;

  return (
    <div
      inert={!shown}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-stone-200 dark:border-stone-800 bg-white/95 dark:bg-stone-950/95 backdrop-blur px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] transition-transform duration-200 motion-reduce:transition-none md:hidden ${
        shown ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <button
        type="button"
        onClick={() => {
          onClick?.();
          // After the form opens, so it lands in view whole. A jump, not a
          // glide: the form growing above the screen cut a smooth scroll short
          requestAnimationFrame(() =>
            target.current?.scrollIntoView({ block: "center" }),
          );
        }}
        className={`w-full ${className}`}
      >
        {label}
      </button>
    </div>
  );
}

export function ErrorBoundary() {
  return <ErrorPage what="book" />;
}
