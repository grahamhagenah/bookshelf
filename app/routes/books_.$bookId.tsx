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
import { HistoryIcon, PersonAddIcon } from "~/components/icons";
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
  getUserById,
  getUserEmailById,
  createBookRequestNotification,
  createBookReturnedNotification,
  createNotification,
  createOverdueReminderNotification,
} from "~/models/user.server";
import { requireUserId } from "~/session.server";

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
    <div className="relative w-[200px] h-[300px] overflow-hidden rounded-md">
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

  const book = await getBookById(params.bookId);
  if (!book) {
    throw new Response("Not Found", { status: 404 });
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

  // Fetch lending history for the book
  const lendingHistory = await getLendingHistory(params.bookId);

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

  return (
    <>
      <main className="flex flex-col md:flex-row gap-8 md:gap-12 p-8 w-full max-w-5xl mx-auto mt-4 md:mt-12">
        <section className="order-2 md:order-1 flex-shrink-0">
          <div className="book-cover p-8 md:p-0">
            <BookCover
              src={data.book.cover}
              title={data.book.title}
              author={data.book.author}
            />
          </div>
          {canRequestBook ? (
            <Form method="post">
              <input type="hidden" name="intent" value="request" />
              <button
                type="submit"
                disabled={isSubmitting || requestSent}
                className={`mb-4 rounded border-2 w-full mt-8 px-4 py-3 text-base font-medium ${
                  requestSent
                    ? "border-stone-900 dark:border-stone-100 text-stone-900 dark:text-stone-100 bg-stone-100 cursor-default"
                    : isSubmitting
                      ? "border-stone-300 text-stone-400 cursor-wait"
                      : "border-stone-900 dark:border-stone-100 text-stone-900 dark:text-stone-100 hover:bg-stone-50 focus:bg-stone-100"
                }`}
              >
                {requestSent
                  ? "Request Sent"
                  : isSubmitting
                    ? "Requesting..."
                    : "Request Book"}
              </button>
            </Form>
          ) : null}
          {needsFriendship && data.book.user ? (
            <div className="mt-8 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-lg p-4">
              <p className="text-stone-800 dark:text-stone-200 text-sm mb-3">
                Add{" "}
                <span className="font-semibold">
                  {data.book.user.firstname} {data.book.user.surname}
                </span>{" "}
                as a friend to borrow their books.
              </p>
              <Form method="post">
                <input type="hidden" name="intent" value="friendRequest" />
                <button
                  type="submit"
                  disabled={isSendingFriendRequest || friendRequestSent}
                  className={`rounded w-full px-4 py-2 text-sm font-medium ${
                    friendRequestSent
                      ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 cursor-default"
                      : isSendingFriendRequest
                        ? "bg-stone-300 text-stone-500 cursor-wait"
                        : "bg-stone-500 text-white hover:bg-stone-600"
                  }`}
                >
                  {friendRequestSent
                    ? "Friend Request Sent!"
                    : isSendingFriendRequest
                      ? "Sending..."
                      : "Send Friend Request"}
                </button>
              </Form>
            </div>
          ) : null}
          {data.isBorrower ? (
            <>
              {data.book.user ? (
                <div
                  className={`border rounded-lg p-4 mt-8 ${
                    data.book.dueDate &&
                    new Date(data.book.dueDate) < new Date()
                      ? "bg-stone-100 border-stone-200"
                      : "bg-stone-100 border-stone-200"
                  }`}
                >
                  <p
                    className={`text-sm ${
                      data.book.dueDate &&
                      new Date(data.book.dueDate) < new Date()
                        ? "text-stone-900 dark:text-stone-100"
                        : "text-stone-900 dark:text-stone-100"
                    }`}
                  >
                    <span className="font-semibold">Borrowed from:</span>{" "}
                    {data.book.user.firstname} {data.book.user.surname}
                  </p>
                  {data.book.borrowedAt ? (
                    <p
                      className={`text-sm mt-1 ${
                        data.book.dueDate &&
                        new Date(data.book.dueDate) < new Date()
                          ? "text-stone-900 dark:text-stone-100"
                          : "text-stone-900 dark:text-stone-100"
                      }`}
                    >
                      <span className="font-semibold">Since:</span>{" "}
                      {new Date(data.book.borrowedAt).toLocaleDateString(
                        "en-US",
                        {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        },
                      )}
                    </p>
                  ) : null}
                  {data.book.dueDate ? (
                    <p
                      className={`text-sm mt-1 font-semibold ${
                        new Date(data.book.dueDate) < new Date()
                          ? "text-stone-900 dark:text-stone-100"
                          : "text-stone-900 dark:text-stone-100"
                      }`}
                    >
                      {new Date(data.book.dueDate) < new Date() ? (
                        <>
                          Overdue! Was due{" "}
                          {new Date(data.book.dueDate).toLocaleDateString(
                            "en-US",
                            {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </>
                      ) : (
                        <>
                          Due:{" "}
                          {new Date(data.book.dueDate).toLocaleDateString(
                            "en-US",
                            {
                              month: "long",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </>
                      )}
                    </p>
                  ) : null}
                </div>
              ) : null}
              <Form method="post">
                <input type="hidden" name="intent" value="return" />
                <button
                  type="submit"
                  className={`mb-4 rounded border-2 border-stone-500 w-full ${data.book.user ? "mt-4" : "mt-8"} px-4 py-3 text-base font-medium text-stone-600 hover:bg-stone-50 focus:bg-stone-100`}
                >
                  Return Book
                </button>
              </Form>
            </>
          ) : null}
        </section>
        <section className="order-1 md:order-2 flex-1">
          {isEditing ? (
            /* Edit Mode */
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="edit" />

              <div className="flex items-center justify-between mb-4">
                <h3 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
                  Edit Book
                </h3>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-stone-500 hover:text-stone-700 dark:hover:text-stone-300"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1"
                >
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  defaultValue={data.book.title}
                  className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="cover"
                  className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1"
                >
                  Cover URL
                </label>
                <div className="flex gap-3">
                  <input
                    type="url"
                    id="cover"
                    name="cover"
                    defaultValue={data.book.cover}
                    placeholder="https://covers.openlibrary.org/..."
                    className="flex-1 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 focus:border-stone-900 focus:ring-1 focus:ring-stone-900 text-sm"
                  />
                  {data.book.cover ? (
                    <img
                      src={data.book.cover}
                      alt="Current cover"
                      className="w-10 h-14 object-cover rounded border border-stone-200 dark:border-stone-700"
                    />
                  ) : null}
                </div>
              </div>

              <div>
                <label
                  htmlFor="author"
                  className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1"
                >
                  Author
                </label>
                <input
                  type="text"
                  id="author"
                  name="author"
                  defaultValue={data.book.author}
                  className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="body"
                  className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1"
                >
                  Description
                </label>
                <textarea
                  id="body"
                  name="body"
                  rows={4}
                  defaultValue={data.book.body}
                  className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="datePublished"
                    className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1"
                  >
                    Year Published
                  </label>
                  <input
                    type="text"
                    id="datePublished"
                    name="datePublished"
                    defaultValue={data.book.datePublished || ""}
                    placeholder="e.g. 1984"
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                  />
                </div>
                <div>
                  <label
                    htmlFor="pageCount"
                    className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1"
                  >
                    Page Count
                  </label>
                  <input
                    type="number"
                    id="pageCount"
                    name="pageCount"
                    defaultValue={data.book.pageCount || ""}
                    className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="publisher"
                  className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1"
                >
                  Publisher
                </label>
                <input
                  type="text"
                  id="publisher"
                  name="publisher"
                  defaultValue={data.book.publisher || ""}
                  className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                />
              </div>

              <div>
                <label
                  htmlFor="subjects"
                  className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1"
                >
                  Subjects
                </label>
                <input
                  type="text"
                  id="subjects"
                  name="subjects"
                  defaultValue={data.book.subjects || ""}
                  placeholder="Comma-separated, e.g. Fiction, Adventure, Classic"
                  className="w-full rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-2 text-stone-900 dark:text-stone-100 focus:border-stone-900 focus:ring-1 focus:ring-stone-900"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isSaving}
                  className={`rounded-lg px-4 py-2 font-medium ${
                    isSaving
                      ? "bg-stone-300 text-stone-500 cursor-wait"
                      : "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-300"
                  }`}
                >
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>

              <hr className="my-6" />

              <div className="space-y-4">
                <h4 className="font-semibold text-stone-900 dark:text-stone-100">
                  Actions
                </h4>

                {data.book.openLibraryKey ? (
                  <a
                    href={`https://openlibrary.org${data.book.openLibraryKey}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-stone-900 dark:text-stone-100 hover:text-stone-900 text-sm"
                  >
                    View on Open Library →
                  </a>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Form method="post">
                    <input type="hidden" name="intent" value="refresh" />
                    <button
                      type="submit"
                      disabled={isRefreshing}
                      className={`rounded-lg border-2 px-4 py-2 text-sm ${
                        isRefreshing
                          ? "border-stone-300 text-stone-400 cursor-wait"
                          : "border-stone-900 dark:border-stone-100 text-stone-900 dark:text-stone-100 hover:bg-stone-50 dark:hover:bg-stone-800"
                      }`}
                    >
                      {isRefreshing
                        ? "Refreshing..."
                        : "Refresh from Open Library"}
                    </button>
                  </Form>
                  <Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <button
                      type="submit"
                      className="rounded-lg border-2 border-stone-900 dark:border-stone-100 px-4 py-2 text-sm text-stone-900 dark:text-stone-100 hover:bg-stone-50 dark:hover:bg-stone-800"
                    >
                      Delete Book
                    </button>
                  </Form>
                </div>
                {refreshResult ? (
                  <p
                    className={`text-sm ${refreshResult.refreshed ? "text-stone-900 dark:text-stone-100" : "text-stone-600"}`}
                  >
                    {refreshResult.message}
                  </p>
                ) : null}
              </div>
            </Form>
          ) : (
            /* View Mode */
            <>
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-4xl md:text-5xl font-bold">
                  {data.book.title}
                </h3>
                {data.isOwner ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex-shrink-0 text-sm px-3 py-1 rounded-md border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600 hover:text-stone-800 dark:hover:text-stone-200 transition-colors"
                  >
                    Edit
                  </button>
                ) : null}
              </div>
              <h4 className="text-3xl md:text-4xl author py-4">
                {data.book.author}
              </h4>

              <div className="flex flex-wrap gap-x-6 gap-y-2 py-4 text-sm text-stone-600 dark:text-stone-400">
                {data.book.datePublished ? (
                  <div>
                    <span className="font-semibold">Published:</span>{" "}
                    {data.book.datePublished}
                  </div>
                ) : null}
                {data.book.pageCount ? (
                  <div>
                    <span className="font-semibold">Pages:</span>{" "}
                    {data.book.pageCount}
                  </div>
                ) : null}
                {data.book.publisher ? (
                  <div>
                    <span className="font-semibold">Publisher:</span>{" "}
                    {data.book.publisher}
                  </div>
                ) : null}
                {!data.isOwner && data.book.user ? (
                  <div>
                    <span className="font-semibold">Owner:</span>{" "}
                    {data.book.user.firstname} {data.book.user.surname}
                  </div>
                ) : null}
              </div>

              {data.book.subjects ? (
                <div className="py-2">
                  <div className="flex flex-wrap gap-2">
                    {data.book.subjects.split(", ").map((subject, index) => (
                      <span
                        key={index}
                        className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs px-3 py-1 rounded-full"
                      >
                        {subject}
                      </span>
                    ))}
                  </div>
                </div>
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
                    className={`border rounded-lg p-4 my-4 ${isOverdue ? "bg-stone-100 border-stone-200 dark:bg-stone-800 dark:border-stone-600" : "bg-stone-50 border-stone-200 dark:bg-stone-950 dark:border-stone-800"}`}
                  >
                    <p
                      className={
                        isOverdue
                          ? "text-stone-900 dark:text-stone-100 dark:text-stone-100"
                          : "text-stone-800 dark:text-stone-200"
                      }
                    >
                      <span className="font-semibold">Currently lent to:</span>{" "}
                      <span
                        className={
                          isOverdue
                            ? "text-stone-900 dark:text-stone-100 dark:text-stone-100"
                            : "text-stone-700 dark:text-stone-300"
                        }
                      >
                        {data.book.borrower.firstname}{" "}
                        {data.book.borrower.surname}
                      </span>
                    </p>
                    {data.book.borrowedAt ? (
                      <p
                        className={`text-sm mt-1 ${isOverdue ? "text-stone-900 dark:text-stone-100 dark:text-stone-100" : "text-stone-700 dark:text-stone-300"}`}
                      >
                        <span className="font-semibold">Since:</span>{" "}
                        {new Date(data.book.borrowedAt).toLocaleDateString(
                          "en-US",
                          {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </p>
                    ) : null}
                    {dueDate ? (
                      <p
                        className={`text-sm mt-1 font-semibold ${isOverdue ? "text-stone-900 dark:text-stone-100 dark:text-stone-100" : "text-stone-700 dark:text-stone-300"}`}
                      >
                        {isOverdue ? (
                          <>
                            Overdue by {Math.abs(daysLeft!)}{" "}
                            {Math.abs(daysLeft!) === 1 ? "day" : "days"}
                          </>
                        ) : daysLeft !== null && daysLeft <= 3 ? (
                          <>
                            Due in {daysLeft} {daysLeft === 1 ? "day" : "days"}{" "}
                            — reminder will be sent
                          </>
                        ) : (
                          <>
                            Due in {daysLeft} days (
                            {dueDate.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                            )
                          </>
                        )}
                      </p>
                    ) : null}
                    <Form method="post" className="mt-3">
                      <input type="hidden" name="intent" value="sendReminder" />
                      <button
                        type="submit"
                        disabled={isSendingReminder || reminderSent}
                        className={`text-sm px-3 py-1.5 rounded ${
                          reminderSent
                            ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 cursor-default"
                            : isSendingReminder
                              ? "bg-stone-300 text-stone-500 cursor-wait"
                              : isOverdue
                                ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-700 dark:hover:bg-stone-300"
                                : "bg-stone-600 text-white hover:bg-stone-700"
                        }`}
                      >
                        {reminderSent
                          ? "Reminder Sent!"
                          : isSendingReminder
                            ? "Sending..."
                            : "Send Return Reminder"}
                      </button>
                    </Form>
                  </div>
                );
              })()
            : null}

          {!isEditing ? (
            <div className="py-4">
              <h5 className="font-semibold text-lg mb-2">Description</h5>
              <p className="summary text-stone-700 dark:text-stone-300 leading-relaxed">
                {data.book.body || "No description available."}
              </p>
            </div>
          ) : null}

          {!isEditing &&
          data.lendingHistory &&
          data.lendingHistory.length > 0 ? (
            <div className="py-4">
              <h5 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <HistoryIcon size={20} className="text-stone-400" />
                Lending History
              </h5>
              <ul className="space-y-1">
                {data.lendingHistory.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between text-sm py-2 border-b border-stone-100 dark:border-stone-800 last:border-0"
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
                    <div className="text-stone-400 text-xs">
                      {new Date(entry.borrowedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                      {entry.returnedAt ? (
                        <span>
                          {" "}
                          —{" "}
                          {new Date(entry.returnedAt).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric", year: "numeric" },
                          )}
                        </span>
                      ) : null}
                      {!entry.returnedAt ? (
                        <span className="ml-2 text-stone-600">Current</span>
                      ) : null}
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
