import type {
  SerializeFrom,
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  useFetcher,
  Form,
  isRouteErrorResponse,
  Link,
  useLoaderData,
  useRouteError,
  useNavigation,
  useActionData,
} from "@remix-run/react";
import { useEffect, useRef, useState } from "react";
import invariant from "tiny-invariant";

import Avatar from "~/components/avatar";
import CoverPlaceholder from "~/components/cover-placeholder";
import { LentIcon } from "~/components/icons";
import PersonLink from "~/components/person-link";
import ReaderNotes from "~/components/reader-notes";
import { importCover, isOpenLibraryCover } from "~/covers.server";
import { sendBookRequestEmail } from "~/email.server";
import {
  deleteBook,
  getBookById,
  getReadAt,
  setRead,
  DEFAULT_LOAN_WEEKS,
  EXTEND_WEEKS,
  extendLoan,
  LOAN_WEEKS,
  lendToFriend,
  loanWeeks,
  returnBook,
  updateBookMetadata,
  getLendingHistory,
  tidySubjects,
} from "~/models/book.server";
import { canInteract, respondAsDemoPersona } from "~/models/demo.server";
import {
  getHolds,
  leaveHold,
  passToNextInLine,
  placeHold,
} from "~/models/hold.server";
import { shelfIds } from "~/models/household.server";
import {
  NOTE_MAX_LENGTH,
  canLeaveNote,
  getReaderNotes,
  saveReaderNote,
} from "~/models/note.server";
import { ensureBookDetails, getAuthor, tidyAuthor } from "~/models/openlibrary.server";
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
} from "~/models/user.server";
import { LIMIT_MESSAGES, UPGRADE_PATH } from "~/plan";
import { roomForFriend } from "~/plan.server";
import type { CoversResponse } from "~/routes/api.covers";
import { seo } from "~/seo";
import { requireUserId } from "~/session.server";
import {
  cleanSubjects,
  coverSrc,
  editionPublisher,
  ENGLISH_EDITION_FIELDS,
  ENGLISH_EDITION_PARAMS,
  stripMarkdown,
} from "~/utils";

// "Oct 21", adding the year only when it isn't this year
const monthDay = (date: string | Date) => {
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
};

const primaryButton =
  "rounded-md bg-forest-600 px-4 py-2 text-sm font-medium text-white hover:bg-forest-700 transition-colors";
const secondaryButton =
  "rounded-md border border-stone-200 dark:border-stone-700 px-4 py-2 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors";
const quietLabel =
  "rounded-md bg-stone-100 dark:bg-stone-800 px-4 py-2 text-sm text-stone-500 dark:text-stone-400 cursor-default";
const panel = "text-sm";
const labelClass =
  "block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1.5";
const inputClass =
  "w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:border-stone-400 dark:focus:border-stone-500 focus:ring-2 focus:ring-stone-900/10 dark:focus:ring-white/10 transition-colors";

// "1920–1986" from Open Library's free-form dates
function lifespan(birth: string | null, death: string | null) {
  const year = (date: string | null) => date?.match(/\d{3,4}/)?.[0] ?? null;
  const born = year(birth);
  const died = year(death);
  if (born && died) return `${born}–${died}`;
  if (born) return `Born ${born}`;
  return null;
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
  const years = lifespan(author.birthDate, author.deathDate);
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
  // links) a tap away. The name itself is already at the top of the page.
  return (
    <section className="mt-8">
      <h2 className="mb-2 text-sm font-semibold text-stone-500 dark:text-stone-400">
        About the author
        {years ? <span className="ml-2 font-normal text-stone-400 dark:text-stone-500">{years}</span> : null}
      </h2>
      {author.bio ? (
        <p
          ref={bioRef}
          id={`bio-${author.key}`}
          className={`summary max-w-prose text-pretty leading-relaxed text-stone-700 dark:text-stone-300 ${
            clipped ? "line-clamp-3 [mask-image:linear-gradient(to_bottom,black_45%,transparent)]" : ""
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
            <a href={author.wikipedia} target="_blank" rel="noopener noreferrer" className={linkClass}>
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
}: {
  src: string;
  title: string;
  author: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const showCover = (img: HTMLImageElement) => {
    // Open Library answers unknown covers with a 1x1 pixel, and a broken
    // image has no width at all
    if (img.naturalWidth <= 1) setError(true);
    else setLoaded(true);
  };

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
          large
          className="absolute inset-0"
        />
      ) : null}
      {!error ? (
        <img
          src={coverSrc(src)}
          alt={title}
          loading="lazy"
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
    </div>
  );
}

interface LoaderData {
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

export const meta: MetaFunction<typeof loader> = ({ data }) =>
  seo({
    title: data?.book ? `${data.book.title} by ${data.book.author}` : "Book",
    noindex: true,
  });

export const handle = {
  breadcrumbs: (data: LoaderData) => {
    const crumbs: { label: string; href?: string }[] = [];

    // Your own book sits in your library; a friend's, on their shelf
    if (data?.isOwner) {
      crumbs.push({ label: "My library", href: "/books" });
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

  // First visit: look up the opening sentence and author from Open Library
  if (!book.detailsFetchedAt) {
    await ensureBookDetails(book);
    book = (await getBookById(params.bookId)) ?? book;
  }
  const [subjects, authorName] = await Promise.all([tidySubjects(book), tidyAuthor(book)]);
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
  const [lendingHistory, readerNotes, canNote, author, holds] = await Promise.all([
    getLendingHistory(params.bookId),
    getReaderNotes(params.bookId),
    canLeaveNote(userId, book),
    getAuthor(book.authorKey),
    getHolds(params.bookId),
  ]);
  // Where you are in line for this book, counting from 1
  const holdIndex = holds.findIndex((hold) => hold.user.id === userId);

  // Mark which borrowers in history are friends
  const lendingHistoryWithFriendStatus = lendingHistory.map((entry) => ({
    ...entry,
    isFriend: followingIds.includes(entry.borrower.id),
    isCurrentUser: entry.borrower.id === userId,
  }));

  return json({
    book,
    // The viewer's own read mark; their housemate has their own
    readAt: await getReadAt(userId, book),
    isOwner,
    isBorrowed,
    isBorrower,
    isFriend,
    currentUser,
    lendingHistory: lendingHistoryWithFriendStatus,
    readerNotes,
    myNote: readerNotes.find((note) => note.user.id === userId) ?? null,
    canNote,
    noteMaxLength: NOTE_MAX_LENGTH,
    extendWeeks: EXTEND_WEEKS,
    loanChoices: { weeks: LOAN_WEEKS, defaultWeeks: DEFAULT_LOAN_WEEKS },
    // Who's waiting is shown to the owner and the borrower; others just
    // see their own place
    waiting:
      isOwner || isBorrower
        ? holds.map((hold) => ({ ...hold.user, since: hold.createdAt }))
        : [],
    linePosition: holdIndex === -1 ? null : holdIndex + 1,
    author,
    friendIds: followingIds,
  });
};

// When a book comes back, ask for it on behalf of whoever is first in line.
// A demo friend who owns it answers straight away, but never on behalf of
// the person who just marked it returned: that's theirs to decide.
async function handOn(bookId: string, actingUserId: string) {
  const request = await passToNextInLine(bookId);
  if (request && request.receiverId !== actingUserId) {
    await respondAsDemoPersona(request.id);
  }
}

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

  if (intent === "toggleRead") {
    if (!(await canLeaveNote(userId, book))) {
      throw new Response("Only readers of this copy can mark it read", { status: 403 });
    }
    await setRead(book.id, userId, formData.get("read") === "true");
    return json({ ok: true });
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
    return json({ noteSaved: true });
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
    if (!(await canInteract(userId, book.userId))) {
      throw new Response("Not Found", { status: 404 });
    }

    const currentUser = await getUserById(userId);
    if (!currentUser) {
      throw new Response("User not found", { status: 404 });
    }

    const senderName = `${currentUser.firstname} ${currentUser.surname}`;
    const bookRequest = await createBookRequestNotification(
      userId,
      book.userId,
      senderName,
      book.id,
      book.title,
    );

    // Demo friends approve on the spot
    await respondAsDemoPersona(bookRequest.id);

    // Send email notification to book owner (if they have email notifications enabled)
    const bookOwner = await getUserEmailById(book.userId);
    if (bookOwner && bookOwner.emailNotifications && bookOwner.emailVerifiedAt) {
      await sendBookRequestEmail({
        toEmail: bookOwner.email,
        toUserId: book.userId,
        toName: bookOwner.firstname || "there",
        requesterName: senderName,
        bookTitle: book.title,
        bookAuthor: book.author,
        bookCover: book.cover,
      });
    }

    return json({ success: true, message: "Book request sent!" });
  }

  if (intent === "placeHold" || intent === "leaveHold") {
    if (intent === "leaveHold") {
      await leaveHold(book.id, userId);
      return json({ leftLine: true });
    }
    // Only for a friend's book that someone else has right now
    const viewer = await getUserById(userId);
    const isFriend =
      viewer?.following.some((friend) => friend.id === book.userId) ?? false;
    if (
      managerIds.includes(book.userId) ||
      !book.borrowerId ||
      book.borrowerId === userId ||
      !isFriend ||
      !(await canInteract(userId, book.userId))
    ) {
      throw new Response("Can't wait for this book", { status: 400 });
    }
    await placeHold(book.id, userId);
    return json({ joinedLine: true });
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
    const owner = await getUserById(userId);
    const isFriend =
      typeof friendId === "string" &&
      (owner?.following.some((friend) => friend.id === friendId) ?? false);
    if (!owner || !isFriend || !(await canInteract(userId, friendId))) {
      throw new Response("Not a friend", { status: 400 });
    }

    await lendToFriend(book.id, userId, friendId, loanWeeks(formData.get("weeks")));
    await createBookApprovedNotification(
      userId,
      friendId,
      `${owner.firstname} ${owner.surname}`,
      book.title,
      book.id,
    );
    return json({ lentTo: friendId });
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
    );

    await returnBook(book.id);
    await handOn(book.id, userId);
    return redirect("/books");
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
    // No new requests once the free plan's friends are all taken
    if (!(await roomForFriend(userId))) {
      return json({ friendRequestSent: false, friendLimit: LIMIT_MESSAGES.friends }, { status: 403 });
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

    return json({ friendRequestSent: true, message: "Friend request sent!" });
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
      return json({ markedReturned: true });
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
    return json({ loanExtended: true });
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
    const overdue = book.dueDate !== null && book.dueDate.getTime() < Date.now();
    await createReminderNotification(userId, book.borrowerId, ownerName, book.id, book.title, overdue);

    return json({ reminderSent: true, message: "Reminder sent!" });
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

    const res = await fetch(
      `https://openlibrary.org/search.json?q=${searchQuery}&limit=1&${ENGLISH_EDITION_PARAMS}&fields=${fields}`,
    );
    const data = await res.json();

    if (data.docs && data.docs.length > 0) {
      const bookData = data.docs[0];

      // Fetch description from Works API
      let description = book.body;
      if (bookData.key) {
        try {
          const workRes = await fetch(
            `https://openlibrary.org${bookData.key}.json`,
          );
          if (workRes.ok) {
            const workData = await workRes.json();
            if (typeof workData.description === "string") {
              description = workData.description;
            } else if (workData.description?.value) {
              description = workData.description.value;
            }
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
      await ensureBookDetails({ id: book.id, detailsFetchedAt: null }, { force: true });
      return json({
        refreshed: true,
        message: "Book info updated from Open Library!",
      });
    }

    return json({
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
    if (coverToSave && /^https?:/.test(coverToSave) && !isOpenLibraryCover(coverToSave)) {
      const local = await importCover(coverToSave);
      if (!local) {
        return json({
          edited: false,
          coverError:
            "That cover couldn't be fetched. Use an image link from Amazon, Goodreads, Google Books or Open Library, under 5 MB.",
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

    return json({ edited: true, message: "Book updated successfully!" });
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
          className={`w-full ${primaryButton} ${pending === "placeHold" ? "opacity-60 cursor-wait" : ""}`}
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
function LendToFriend({
  friends,
  loanChoices,
}: {
  friends: { id: string; firstname: string; surname: string }[];
  loanChoices: { weeks: readonly number[]; defaultWeeks: number };
}) {
  const [open, setOpen] = useState(false);
  const navigation = useNavigation();
  const lending = navigation.formData?.get("intent") === "lendTo";
  const sorted = [...friends].sort((a, b) =>
    `${a.firstname} ${a.surname}`.localeCompare(`${b.firstname} ${b.surname}`),
  );
  const field =
    "h-9 w-full rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-2 text-sm text-stone-800 dark:text-stone-200 focus:outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-900/10";

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`w-full ${secondaryButton}`}>
        Lend to a friend
      </button>
    );
  }

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-stone-500 dark:text-stone-400">
        Add friends to lend them books.{" "}
        <Link to="/friends" className="text-stone-800 dark:text-stone-200 underline underline-offset-2">
          Find friends
        </Link>
      </p>
    );
  }

  return (
    <Form method="post" className="space-y-2">
      <input type="hidden" name="intent" value="lendTo" />
      <label className="block text-xs font-medium text-stone-500 dark:text-stone-400">
        Lend to
        <select name="friendId" required className={`mt-1 ${field}`} defaultValue="">
          <option value="" disabled>
            Choose a friend
          </option>
          {sorted.map((friend) => (
            <option key={friend.id} value={friend.id}>
              {friend.firstname} {friend.surname}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-xs font-medium text-stone-500 dark:text-stone-400">
        For
        <select name="weeks" defaultValue={loanChoices.defaultWeeks} className={`mt-1 ${field}`}>
          {loanChoices.weeks.map((weeks) => (
            <option key={weeks} value={weeks}>
              {weeks} {weeks === 1 ? "week" : "weeks"}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={lending}
          className={`flex-1 ${primaryButton} ${lending ? "opacity-60 cursor-wait" : ""}`}
        >
          {lending ? "Lending…" : "Lend it"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className={secondaryButton}>
          Cancel
        </button>
      </div>
    </Form>
  );
}

type BookData = SerializeFrom<typeof loader>;

// A few facts beside the cover: where the book is, when it arrived, how
// often it's been lent
function BookFacts({ data }: { data: BookData }) {
  const { book } = data;
  const rows: [string, React.ReactNode][] = [];

  // Where it is shows in the label under the cover for the owner, and
  // "Available" goes without saying beside Ask to borrow
  if (!data.isOwner && !data.isBorrower && book.borrower) {
    rows.push(["Status", "Out on loan"]);
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
function waitedFor(since: string) {
  const days = Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000);
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
        <span className="font-normal text-stone-400 dark:text-stone-500">{waiting.length}</span>
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
  const fetcher = useFetcher<{ covers: CoversResponse }>({ key: `covers-${bookId}` });
  const covers = fetcher.data?.covers;
  const loading = fetcher.state !== "idle";

  if (!covers) {
    return (
      <button
        type="button"
        disabled={loading}
        onClick={() => fetcher.load(`/api/covers?bookId=${bookId}`)}
        className="mt-3 text-sm text-stone-700 dark:text-stone-200 underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:underline disabled:opacity-60"
      >
        {loading ? "Looking on Open Library…" : "Or pick a cover from Open Library"}
      </button>
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
    <ul className="mt-3 flex flex-wrap gap-2" aria-label="Covers on Open Library">
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
              <img src={cover.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
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
  const daysLeft = due ? Math.ceil((due.getTime() - Date.now()) / 86_400_000) : null;
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
    overdue ? "font-semibold text-stone-900 dark:text-stone-100" : "text-stone-500 dark:text-stone-400"
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
              data.book.borrowedAt ? `Since ${monthDay(data.book.borrowedAt)}` : null,
              due ? `due ${monthDay(due)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {/* On phones the status goes under the dates, leaving the name room */}
          {status ? <span className={`mt-2 inline-flex sm:hidden ${chip}`}>{status}</span> : null}
        </div>
        {status ? <span className={`hidden sm:inline-flex ${chip}`}>{status}</span> : null}
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
          <p role="status" className="mt-2 min-h-4 text-xs text-stone-500 dark:text-stone-400">
            {extended && due ? `Now due ${monthDay(due)}. ${name} has been told.` : ""}
          </p>
        </div>
        <div className="sm:pl-5">
          <p className={label}>{overdue ? `Ask ${name} to bring it back` : `Remind ${name} it's due`}</p>
          <reminder.Form method="post" className="mt-2">
            <input type="hidden" name="intent" value="sendReminder" />
            <button
              type="submit"
              disabled={sendingReminder || reminderSent}
              // The one thing to do on a loan, so it's the green button
              className={`w-full ${reminderSent ? quietLabel : primaryButton} py-1.5 disabled:cursor-default`}
            >
              {reminderSent ? "Reminder sent" : sendingReminder ? "Sending…" : "Send a reminder"}
            </button>
          </reminder.Form>
        </div>
      </div>

      <div className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 ${divider}`}>
        <p className="text-stone-500 dark:text-stone-400">Got it back in person?</p>
        <returned.Form
          method="post"
          onSubmit={(event) => {
            if (!confirm(`Mark ${data.book.title} as returned?`)) event.preventDefault();
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

// Everyone who has had this copy, newest first, down to the day it
// joined the owner's shelf
function LendingHistory({ data }: { data: BookData }) {
  const { book, currentUser, lendingHistory: entries, isOwner, isFriend } = data;
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
      <h2 className="mb-2 text-lg font-semibold text-stone-900 dark:text-stone-100">
        Lending history
        <span className="ml-2 text-sm font-normal text-stone-400 dark:text-stone-500">
          {lendCount === 0 ? "not lent yet" : `lent ${lendCount} ${lendCount === 1 ? "time" : "times"}`}
        </span>
      </h2>
      <ul className="space-y-3">
        {entries.map((entry) => {
          if (!entry.returnedAt && isOwner && book.borrower?.id === entry.borrower.id) {
            return (
              <li key={entry.id}>
                <LoanCard data={data} />
              </li>
            );
          }
          const person = entry.isCurrentUser && currentUser ? currentUser : entry.borrower;
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
                    `${monthDay(entry.borrowedAt)} – ${monthDay(entry.returnedAt)}`
                  ) : (
                    <>
                      Since {monthDay(entry.borrowedAt)} · <CurrentLoan data={data} />
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
                    : ownerLink(`${ownerPerson.firstname} ${ownerPerson.surname}`)}
              </p>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                Added to {isOwner ? "your" : "their"} shelf · {monthDay(book.createdAt)}
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
    friendLimit?: string;
    reminderSent?: boolean;
  // The pasted cover link couldn't be fetched
  coverError?: string;
    edited?: boolean;
    message?: string;
  } | null;
  const navigation = useNavigation();
  const [isEditing, setIsEditing] = useState(false);
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

  const canRequestBook =
    !data.isOwner && !data.isBorrowed && !data.isBorrower && data.isFriend;
  const needsFriendship = !data.isOwner && !data.isFriend;
  // A friend's book someone else has right now: you can wait for it
  const canWaitInLine =
    !data.isOwner && data.isBorrowed && !data.isBorrower && data.isFriend;
  const details = [
    data.book.datePublished,
    data.book.pageCount ? `${data.book.pageCount} pages` : null,
    data.book.publisher,
  ].filter(Boolean);

  // Title and details: beside the cover on phones, in the main column on
  // larger screens
  const heading = (
    <>
      <h1 className="text-2xl md:text-4xl font-semibold tracking-tight leading-tight text-stone-900 dark:text-stone-100">
        {data.book.title}
      </h1>
      <p className="mt-1 md:text-xl text-stone-500 dark:text-stone-400">
        {data.book.author}
      </p>

      {details.length > 0 ? (
        <p className="mt-3 md:mt-4 text-sm text-stone-500 dark:text-stone-400">
          {details.join(" · ")}
        </p>
      ) : null}
      {!data.isOwner && data.book.user ? (
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
          From{" "}
          <PersonLink
            id={data.book.user.id}
            name={`${data.book.user.firstname} ${data.book.user.surname}`}
            friendIds={data.friendIds}
          />
          &apos;s shelf
        </p>
      ) : null}
    </>
  );

  return (
    <>
      <main className="flex flex-col md:flex-row gap-6 md:gap-12 md:gap-12 px-4 md:px-8 py-8 md:py-12 w-full">
        <section className="flex-shrink-0 md:w-[200px] lg:w-[240px] space-y-4">
          <div className="flex items-start gap-4">
            <BookCover
              src={data.book.cover}
              title={data.book.title}
              author={data.book.author}
            />
            {!isEditing ? (
              <div className="md:hidden min-w-0 flex-1 [overflow-wrap:anywhere]">
                {heading}
              </div>
            ) : null}
          </div>
          {/* Your own copy while it's out: who has it, taking you down to the
              loan in the lending history. On your shelf, Lend to a friend
              says enough. */}
          {data.isOwner && !isEditing && data.book.borrower ? (
            <a
              href="#lending"
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-stone-200 dark:border-stone-700 px-4 py-2 text-sm text-stone-600 dark:text-stone-300 hover:border-stone-400 dark:hover:border-stone-500 hover:text-stone-900 dark:hover:text-stone-100 transition-colors"
            >
              <LentIcon size={14} className="text-stone-400 dark:text-stone-500" />
              Lent to {data.book.borrower.firstname}
            </a>
          ) : null}
          {data.isOwner && !isEditing && !data.book.borrower ? (
            <LendToFriend
              friends={data.currentUser?.following ?? []}
              loanChoices={data.loanChoices}
            />
          ) : null}
          {canRequestBook ? (
            <Form method="post">
              <input type="hidden" name="intent" value="request" />
              <button
                type="submit"
                disabled={isSubmitting || requestSent}
                className={`w-full ${
                  requestSent
                    ? quietLabel
                    : isSubmitting
                      ? `${primaryButton} opacity-60 cursor-wait`
                      : primaryButton
                }`}
              >
                {requestSent
                  ? "Request sent"
                  : isSubmitting
                    ? "Asking…"
                    : "Ask to borrow"}
              </button>
            </Form>
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
                        ? `${primaryButton} opacity-60 cursor-wait`
                        : primaryButton
                  }`}
                >
                  {friendRequestSent
                    ? "Friend request sent"
                    : isSendingFriendRequest
                      ? "Sending…"
                      : "Add friend"}
                </button>
              </Form>
              {actionData?.friendLimit ? (
                <p className="mt-2 text-sm text-stone-600 dark:text-stone-300">
                  {actionData.friendLimit}{" "}
                  <Link to={UPGRADE_PATH} className="font-medium text-forest-700 dark:text-forest-400 underline underline-offset-2">
                    See Stacks Plus
                  </Link>
                </p>
              ) : null}
            </div>
          ) : null}
          {/* Whose it is and when it's due are in the lending history */}
          {data.isBorrower ? (
            <Form method="post">
              <input type="hidden" name="intent" value="return" />
              <button type="submit" className={`w-full ${secondaryButton}`}>
                {data.book.user ? `Return book to ${data.book.user.firstname}` : "Return book"}
              </button>
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
                  className={inputClass}
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
                  className={inputClass}
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
                  className={`${inputClass} leading-relaxed`}
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
                    className={inputClass}
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
                    className={inputClass}
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
                    className={inputClass}
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
                  className={inputClass}
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
                  className={inputClass}
                />
                <p className="mt-1.5 text-xs text-stone-400 dark:text-stone-500">
                  The preview on the left updates after you save. A link from another site is
                  copied here when you save.
                </p>
                {actionData?.coverError ? (
                  <p role="alert" className="mt-1.5 text-sm text-red-700 dark:text-red-400">
                    {actionData.coverError}
                  </p>
                ) : null}
                <CoverPicker bookId={data.book.id} selected={cover} onPick={setCover} />
              </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className={`${primaryButton} ${isSaving ? "opacity-60 cursor-wait" : ""}`}
                  >
                    {isSaving ? "Saving…" : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className={secondaryButton}
                  >
                    Cancel
                  </button>
                </div>
              </Form>

              {/* Kept outside the edit form: forms can't nest */}
              <div className="mt-10 border-t border-stone-100 dark:border-stone-800 pt-6 space-y-5">
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
                      className={`${secondaryButton} ${isRefreshing ? "opacity-60 cursor-wait" : ""}`}
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
                      Removes it from your library for good.
                    </p>
                  </div>
                  <Form
                    method="post"
                    className="flex-shrink-0"
                    onSubmit={(event) => {
                      if (!confirm(`Delete ${data.book.title} from your library?`)) {
                        event.preventDefault();
                      }
                    }}
                  >
                    <input type="hidden" name="intent" value="delete" />
                    <button
                      type="submit"
                      className={`${secondaryButton} hover:bg-stone-900 hover:text-white hover:border-stone-900 dark:hover:bg-stone-100 dark:hover:text-stone-900`}
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
              {/* Room on the right for "Edit details or cover", so a long
                  title wraps before it reaches the button */}
              <div className={`hidden md:block ${data.isOwner ? "md:pr-40" : ""}`}>{heading}</div>

              {cleanSubjects(data.book.subjects).length > 0 ? (
                <div className="md:mt-4 flex flex-wrap gap-1.5">
                  {cleanSubjects(data.book.subjects).map((subject, index) => (
                    <span
                      key={index}
                      className="rounded-full bg-stone-100 dark:bg-stone-800 px-2.5 py-0.5 text-xs text-stone-600 dark:text-stone-300"
                    >
                      {subject}
                    </span>
                  ))}
                </div>
              ) : null}

              {/* Rarely needed, so it sits quietly in the top corner on
                  wider screens, and under the details on phones */}
              {data.isOwner ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="mt-3 md:absolute md:right-0 md:top-1 md:mt-0 text-sm text-stone-400 dark:text-stone-500 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                >
                  Edit details or cover
                </button>
              ) : null}
            </>
          )}

          {!isEditing && data.book.firstSentence ? (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400 mb-2">
                Opening line
              </h2>
              <blockquote className="border-l-2 border-stone-200 dark:border-stone-700 pl-4 italic text-stone-700 dark:text-stone-300 leading-relaxed max-w-prose">
                “{data.book.firstSentence}”
              </blockquote>
            </div>
          ) : null}

          {!isEditing ? (
            <div className="mt-8">
              <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400 mb-2">
                About this book
              </h2>
              <p className="summary text-stone-700 dark:text-stone-300 leading-relaxed max-w-prose">
                {data.book.body ? stripMarkdown(data.book.body) : "No description yet."}
              </p>
            </div>
          ) : null}

          {!isEditing && data.author ? <AboutAuthor author={data.author} /> : null}

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
        </section>
      </main>
    </>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (error instanceof Error) {
    return <div>An unexpected error occurred: {error.message}</div>;
  }

  if (!isRouteErrorResponse(error)) {
    return <h1>Unknown Error</h1>;
  }

  if (error.status === 404) {
    return <div>Book not found</div>;
  }

  return <div>An unexpected error occurred: {error.statusText}</div>;
}
