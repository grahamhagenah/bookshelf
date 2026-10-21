import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  isRouteErrorResponse,
  Link,
  useLoaderData,
  useRouteError,
  useNavigation,
  useActionData,
} from "@remix-run/react";
import { useState, useEffect } from "react";
import invariant from "tiny-invariant";

import Avatar from "~/components/avatar";
import CoverPlaceholder from "~/components/cover-placeholder";
import { PersonAddIcon } from "~/components/icons";
import ReaderNotes from "~/components/reader-notes";
import { sendBookRequestEmail } from "~/email.server";
import {
  deleteBook,
  getBookById,
  returnBook,
  updateBookMetadata,
  getLendingHistory,
} from "~/models/book.server";
import { canInteract, respondAsDemoPersona } from "~/models/demo.server";
import {
  NOTE_MAX_LENGTH,
  canLeaveNote,
  getReaderNotes,
  saveReaderNote,
} from "~/models/note.server";
import { ensureBookDetails, getAuthor } from "~/models/openlibrary.server";
import {
  getUserById,
  getUserEmailById,
  createBookRequestNotification,
  createBookReturnedNotification,
  createNotification,
  createOverdueReminderNotification,
  createReaderNoteNotification,
} from "~/models/user.server";
import { requireUserId } from "~/session.server";

const longDate = (date: string | Date) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const shortDate = (date: string | Date) =>
  new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

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
  "rounded-md bg-stone-900 dark:bg-stone-100 px-4 py-2 text-sm font-medium text-white dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-300 transition-colors";
const secondaryButton =
  "rounded-md border border-stone-200 dark:border-stone-700 px-4 py-2 text-sm text-stone-700 dark:text-stone-200 hover:border-stone-400 dark:hover:border-stone-500 transition-colors";
const quietLabel =
  "rounded-md bg-stone-100 dark:bg-stone-800 px-4 py-2 text-sm text-stone-500 dark:text-stone-400 cursor-default";
const panel = "rounded-lg bg-stone-50 dark:bg-stone-900 p-4 text-sm";
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
  const [expanded, setExpanded] = useState(false);
  const years = lifespan(author.birthDate, author.deathDate);
  const isLong = (author.bio?.length ?? 0) > 320;

  return (
    <div className="mt-8">
      <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400 mb-2">
        About the author
      </h2>
      <p className="text-stone-900 dark:text-stone-100">
        <span className="font-medium">{author.name}</span>
        {years ? (
          <span className="ml-2 text-sm text-stone-400 dark:text-stone-500">
            {years}
          </span>
        ) : null}
      </p>
      {author.bio ? (
        <>
          <p
            className={`summary mt-1 text-stone-700 dark:text-stone-300 leading-relaxed max-w-prose ${
              isLong && !expanded ? "line-clamp-4" : ""
            }`}
          >
            {author.bio}
          </p>
          {isLong ? (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-1 text-sm text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          ) : null}
        </>
      ) : null}
      <p className="mt-2 flex gap-4 text-sm">
        {author.wikipedia ? (
          <a
            href={author.wikipedia}
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-500 dark:text-stone-400 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-800 dark:hover:text-stone-200"
          >
            Wikipedia
          </a>
        ) : null}
        <a
          href={`https://openlibrary.org/authors/${author.key}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-stone-500 dark:text-stone-400 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-800 dark:hover:text-stone-200"
        >
          More on Open Library
        </a>
      </p>
    </div>
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

  return (
    <div className="relative w-[140px] h-[210px] md:w-[200px] md:h-[300px] overflow-hidden rounded-md shadow-sm ring-1 ring-stone-900/5 dark:ring-white/10">
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
          src={src}
          alt={title}
          loading="lazy"
          decoding="async"
          className={`relative w-full h-full object-cover ${loaded ? "opacity-100" : "opacity-0"} transition-opacity duration-300`}
          onLoad={(e) => {
            // Open Library answers unknown covers with a 1x1 pixel
            if (e.currentTarget.naturalWidth <= 1) setError(true);
            else setLoaded(true);
          }}
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

export const handle = {
  breadcrumbs: (data: LoaderData) => {
    const crumbs: { label: string; href?: string }[] = [];

    // If viewing a friend's book, add Friends and friend name
    if (!data?.isOwner && data?.book?.user) {
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

  const isOwner = book.userId === userId;
  const isBorrower = book.borrowerId === userId;
  const isBorrowed = book.borrowerId !== null;

  const currentUser = await getUserById(userId);
  const followingIds = currentUser?.following?.map((friend) => friend.id) ?? [];
  const isFriend = followingIds.includes(book.userId);

  // If not the owner, check if the owner is a friend, borrower, or has public sharing
  if (!isOwner && !isBorrower && !isFriend) {
    // Check if owner has public sharing enabled
    const ownerHasPublicSharing = book.user?.shareToken !== null;
    if (!ownerHasPublicSharing) {
      throw new Response("Not Found", { status: 404 });
    }
  }

  // Fetch lending history and reader notes for the book
  const [lendingHistory, readerNotes, canNote, author] = await Promise.all([
    getLendingHistory(params.bookId),
    getReaderNotes(params.bookId),
    canLeaveNote(userId, book),
    getAuthor(book.authorKey),
  ]);

  // Mark which borrowers in history are friends
  const lendingHistoryWithFriendStatus = lendingHistory.map((entry) => ({
    ...entry,
    isFriend: followingIds.includes(entry.borrower.id),
    isCurrentUser: entry.borrower.id === userId,
  }));

  return json({
    book,
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
    author,
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
    if (book.userId !== userId) {
      throw new Response("Unauthorized", { status: 403 });
    }
    await deleteBook({ id: params.bookId, userId });
    return redirect("/books");
  }

  if (intent === "request") {
    // Can't request your own book
    if (book.userId === userId) {
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
    if (bookOwner && bookOwner.emailNotifications) {
      await sendBookRequestEmail({
        toEmail: bookOwner.email,
        toName: bookOwner.firstname || "there",
        requesterName: senderName,
        bookTitle: book.title,
      });
    }

    return json({ success: true, message: "Book request sent!" });
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

  if (intent === "sendReminder") {
    // Only owner can send reminder
    if (book.userId !== userId) {
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
    await createOverdueReminderNotification(
      userId,
      book.borrowerId,
      ownerName,
      book.id,
      book.title,
    );

    return json({ reminderSent: true, message: "Reminder sent!" });
  }

  if (intent === "refresh") {
    // Only owner can refresh metadata
    if (book.userId !== userId) {
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
      "publisher",
      "key",
    ].join(",");

    const res = await fetch(
      `https://openlibrary.org/search.json?q=${searchQuery}&limit=1&fields=${fields}`,
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
        subjects: bookData.subject?.slice(0, 5).join(", ") || null,
        publisher: bookData.publisher?.[0] || null,
        openLibraryKey: bookData.key || null,
        body: description,
      });
      await ensureBookDetails(
        {
          id: book.id,
          title: book.title,
          author: book.author,
          openLibraryKey: bookData.key || null,
          detailsFetchedAt: null,
        },
        { force: true },
      );
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
    if (book.userId !== userId) {
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

    await updateBookMetadata(book.id, {
      title: typeof title === "string" ? title : undefined,
      author: typeof author === "string" ? author : undefined,
      cover: typeof cover === "string" && cover ? cover : undefined,
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

export default function BookDetailsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as {
    success?: boolean;
    refreshed?: boolean;
    friendRequestSent?: boolean;
    reminderSent?: boolean;
    edited?: boolean;
    message?: string;
  } | null;
  const navigation = useNavigation();
  const [isEditing, setIsEditing] = useState(false);

  const isSubmitting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "request";
  const isRefreshing =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "refresh";
  const isSendingFriendRequest =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "friendRequest";
  const isSendingReminder =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "sendReminder";
  const isSaving =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "edit";
  const requestSent = actionData?.success === true;
  const friendRequestSent = actionData?.friendRequestSent === true;
  const reminderSent = actionData?.reminderSent === true;
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
  const details = [
    data.book.datePublished,
    data.book.pageCount ? `${data.book.pageCount} pages` : null,
    data.book.publisher,
  ].filter(Boolean);

  return (
    <>
      <main className="flex flex-col md:flex-row gap-8 md:gap-12 px-4 md:px-8 py-8 md:py-12 w-full">
        <section className="flex-shrink-0 md:w-[200px] space-y-4">
          <BookCover
            src={data.book.cover}
            title={data.book.title}
            author={data.book.author}
          />
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
            </div>
          ) : null}
          {data.isBorrower ? (
            <div className={panel}>
              {data.book.user ? (
                <div className="mb-3 space-y-0.5">
                  <p className="text-stone-800 dark:text-stone-200">
                    Borrowed from{" "}
                    <span className="font-semibold">
                      {data.book.user.firstname} {data.book.user.surname}
                    </span>
                  </p>
                  {data.book.borrowedAt ? (
                    <p className="text-stone-500 dark:text-stone-400">
                      Since {longDate(data.book.borrowedAt)}
                    </p>
                  ) : null}
                  {data.book.dueDate ? (
                    new Date(data.book.dueDate) < new Date() ? (
                      <p className="font-semibold text-stone-900 dark:text-stone-100">
                        Overdue since {longDate(data.book.dueDate)}
                      </p>
                    ) : (
                      <p className="text-stone-500 dark:text-stone-400">
                        Due {longDate(data.book.dueDate)}
                      </p>
                    )
                  ) : null}
                </div>
              ) : null}
              <Form method="post">
                <input type="hidden" name="intent" value="return" />
                <button type="submit" className={`w-full ${secondaryButton}`}>
                  Return book
                </button>
              </Form>
            </div>
          ) : null}
        </section>
        <section className="flex-1 min-w-0">
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
                  defaultValue={data.book.cover}
                  placeholder="https://covers.openlibrary.org/..."
                  className={inputClass}
                />
                <p className="mt-1.5 text-xs text-stone-400 dark:text-stone-500">
                  The preview on the left updates after you save.
                </p>
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
              <h1 className="text-3xl md:text-4xl font-semibold tracking-tight leading-tight text-stone-900 dark:text-stone-100">
                {data.book.title}
              </h1>
              <p className="mt-1 text-lg md:text-xl text-stone-500 dark:text-stone-400">
                {data.book.author}
              </p>

              {details.length > 0 ? (
                <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">
                  {details.join(" · ")}
                </p>
              ) : null}
              {!data.isOwner && data.book.user ? (
                <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                  From {data.book.user.firstname} {data.book.user.surname}&apos;s
                  shelf
                </p>
              ) : null}

              {data.book.subjects ? (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {data.book.subjects.split(", ").map((subject, index) => (
                    <span
                      key={index}
                      className="rounded-full bg-stone-100 dark:bg-stone-800 px-2.5 py-0.5 text-xs text-stone-600 dark:text-stone-300"
                    >
                      {subject}
                    </span>
                  ))}
                </div>
              ) : null}

              {/* Rarely needed, so it sits quietly under the details */}
              {data.isOwner ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="mt-3 text-sm text-stone-400 dark:text-stone-500 underline underline-offset-2 decoration-stone-300 dark:decoration-stone-600 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                >
                  Edit details
                </button>
              ) : null}
            </>
          )}

          {!isEditing && data.isOwner && data.isBorrowed && data.book.borrower
            ? (() => {
                const dueDate = data.book.dueDate
                  ? new Date(data.book.dueDate)
                  : null;
                const now = new Date();
                const isOverdue = dueDate && dueDate < now;
                const daysLeft = dueDate
                  ? Math.ceil(
                      (dueDate.getTime() - now.getTime()) /
                        (1000 * 60 * 60 * 24),
                    )
                  : null;

                return (
                  <div
                    className={`${panel} mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`}
                  >
                    <p className="text-stone-800 dark:text-stone-200">
                      Lent to{" "}
                      <span className="font-semibold">
                        {data.book.borrower.firstname}{" "}
                        {data.book.borrower.surname}
                      </span>
                      {data.book.borrowedAt ? (
                        <span className="text-stone-500 dark:text-stone-400">
                          {" "}
                          since {monthDay(data.book.borrowedAt)}
                        </span>
                      ) : null}
                      {dueDate ? (
                        <span
                          className={
                            isOverdue
                              ? "font-semibold text-stone-900 dark:text-stone-100"
                              : "text-stone-500 dark:text-stone-400"
                          }
                        >
                          {" · "}
                          {isOverdue ? (
                            <>
                              overdue by {Math.abs(daysLeft!)}{" "}
                              {Math.abs(daysLeft!) === 1 ? "day" : "days"}
                            </>
                          ) : daysLeft !== null && daysLeft <= 3 ? (
                            <>
                              due in {daysLeft} {daysLeft === 1 ? "day" : "days"}
                            </>
                          ) : (
                            <>due {monthDay(dueDate)}</>
                          )}
                        </span>
                      ) : null}
                    </p>
                    <Form method="post" className="flex-shrink-0">
                      <input type="hidden" name="intent" value="sendReminder" />
                      <button
                        type="submit"
                        disabled={isSendingReminder || reminderSent}
                        className={
                          reminderSent
                            ? quietLabel
                            : isSendingReminder
                              ? `${secondaryButton} opacity-60 cursor-wait`
                              : isOverdue
                                ? primaryButton
                                : secondaryButton
                        }
                      >
                        {reminderSent
                          ? "Reminder sent"
                          : isSendingReminder
                            ? "Sending…"
                            : "Send a reminder"}
                      </button>
                    </Form>
                  </div>
                );
              })()
            : null}

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
                {data.book.body || "No description yet."}
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
            />
          ) : null}

          {!isEditing &&
          data.lendingHistory &&
          data.lendingHistory.length > 0 ? (
            <div className="mt-10">
              <h2 className="text-sm font-semibold text-stone-500 dark:text-stone-400 mb-1">
                Lending history
              </h2>
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {data.lendingHistory.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 text-sm py-2.5"
                  >
                    <div className="flex items-center gap-3">
                      {entry.isCurrentUser ? (
                        <Avatar
                          firstname={data.currentUser?.firstname}
                          surname={data.currentUser?.surname}
                          icon={data.currentUser?.profileEmoji}
                          size="sm"
                        />
                      ) : (
                        <Avatar
                          firstname={entry.borrower.firstname}
                          surname={entry.borrower.surname}
                          icon={entry.borrower.profileEmoji}
                          size="sm"
                        />
                      )}
                      {entry.isCurrentUser ? (
                        <span className="font-medium text-stone-900 dark:text-stone-100">
                          You
                        </span>
                      ) : entry.isFriend ? (
                        <Link
                          to={`/friend/${entry.borrower.id}`}
                          className="font-medium text-stone-900 dark:text-stone-100 hover:text-stone-900 dark:hover:text-white"
                        >
                          {entry.borrower.firstname} {entry.borrower.surname}
                        </Link>
                      ) : entry.borrower.shareToken ? (
                        <Link
                          to={`/shelf/${entry.borrower.shareToken}`}
                          className="font-medium text-stone-900 dark:text-stone-100 hover:text-stone-900 dark:hover:text-white"
                        >
                          {entry.borrower.firstname} {entry.borrower.surname}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-stone-900 dark:text-stone-100">
                            {entry.borrower.firstname} {entry.borrower.surname}
                          </span>
                          <Form method="post" className="inline">
                            <input
                              type="hidden"
                              name="intent"
                              value="friendRequest"
                            />
                            <input
                              type="hidden"
                              name="targetUserId"
                              value={entry.borrower.id}
                            />
                            <button
                              type="submit"
                              className="inline-flex items-center gap-1 text-xs text-stone-600 hover:text-stone-700"
                              title="Add as friend to view their shelf"
                            >
                              <PersonAddIcon size={14} />
                              <span>Add friend</span>
                            </button>
                          </Form>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500 flex-shrink-0">
                      {entry.returnedAt ? (
                        <span>
                          {shortDate(entry.borrowedAt)} – {shortDate(entry.returnedAt)}
                        </span>
                      ) : (
                        <>
                          <span>Since {shortDate(entry.borrowedAt)}</span>
                          <span className="rounded-full bg-stone-100 dark:bg-stone-800 px-2 py-0.5 text-stone-600 dark:text-stone-300">
                            Now
                          </span>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
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
