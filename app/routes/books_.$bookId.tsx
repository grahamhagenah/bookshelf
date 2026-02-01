import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, isRouteErrorResponse, Link, useLoaderData, useRouteError, useNavigation, useActionData } from "@remix-run/react";
import invariant from "tiny-invariant";
import { useState } from "react";
import { deleteBook, getBookById, returnBook, updateBookMetadata, getLendingHistory } from "~/models/book.server";
import { getUserById, getUserEmailById, createBookRequestNotification, createBookReturnedNotification, createNotification, createOverdueReminderNotification } from "~/models/user.server";
import { sendBookRequestEmail } from "~/email.server";
import { requireUserId } from "~/session.server";
import Breadcrumbs from "~/components/breadcrumbs";
import { HistoryIcon, PersonAddIcon } from "~/components/icons";

function BookCover({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative w-[200px] h-[300px] rounded-lg overflow-hidden bg-blue-100">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`w-full h-full object-cover rounded-lg shadow-xl ${loaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

type LoaderData = {
  book: {
    title: string;
    user?: {
      id: string;
      firstname: string;
      surname: string;
    };
  };
  isOwner: boolean;
};

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
  const followingIds = currentUser?.following?.map(friend => friend.id) ?? [];
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
  const lendingHistoryWithFriendStatus = lendingHistory.map(entry => ({
    ...entry,
    isFriend: followingIds.includes(entry.borrower.id),
    isCurrentUser: entry.borrower.id === userId,
  }));

  return json({ book, isOwner, isBorrowed, isBorrower, isFriend, currentUser, lendingHistory: lendingHistoryWithFriendStatus });
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

    const currentUser = await getUserById(userId);
    if (!currentUser) {
      throw new Response("User not found", { status: 404 });
    }

    const senderName = `${currentUser.firstname} ${currentUser.surname}`;
    await createBookRequestNotification(
      userId,
      book.userId,
      senderName,
      book.id,
      book.title
    );

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
      book.title
    );

    await returnBook(book.id);
    return redirect("/books");
  }

  if (intent === "friendRequest") {
    // Check if there's a specific target user (from lending history)
    const targetUserId = formData.get("targetUserId");
    const targetId = typeof targetUserId === "string" ? targetUserId : book.userId;

    // Can't send friend request to yourself
    if (targetId === userId) {
      throw new Response("Cannot send friend request to yourself", { status: 400 });
    }

    const currentUser = await getUserById(userId);
    if (!currentUser) {
      throw new Response("User not found", { status: 404 });
    }

    const senderName = `${currentUser.firstname} ${currentUser.surname}`;
    await createNotification(userId, targetId, senderName);

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
      book.title
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
      'title',
      'author_name',
      'first_publish_year',
      'number_of_pages_median',
      'subject',
      'publisher',
      'key'
    ].join(',');

    const res = await fetch(
      `https://openlibrary.org/search.json?q=${searchQuery}&limit=1&fields=${fields}`
    );
    const data = await res.json();

    if (data.docs && data.docs.length > 0) {
      const bookData = data.docs[0];

      // Fetch description from Works API
      let description = book.body;
      if (bookData.key) {
        try {
          const workRes = await fetch(`https://openlibrary.org${bookData.key}.json`);
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
      return json({ refreshed: true, message: "Book info updated from Open Library!" });
    }

    return json({ refreshed: false, message: "Could not find book on Open Library." });
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
      datePublished: typeof datePublished === "string" && datePublished ? datePublished : null,
      pageCount: typeof pageCount === "string" && pageCount ? parseInt(pageCount, 10) : null,
      publisher: typeof publisher === "string" && publisher ? publisher : null,
      subjects: typeof subjects === "string" && subjects ? subjects : null,
    });

    return json({ edited: true, message: "Book updated successfully!" });
  }

  return null;
};

export default function BookDetailsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as { success?: boolean; refreshed?: boolean; friendRequestSent?: boolean; reminderSent?: boolean; edited?: boolean; message?: string } | null;
  const navigation = useNavigation();
  const [isEditing, setIsEditing] = useState(false);

  const isSubmitting = navigation.state === "submitting" && navigation.formData?.get("intent") === "request";
  const isRefreshing = navigation.state === "submitting" && navigation.formData?.get("intent") === "refresh";
  const isSendingFriendRequest = navigation.state === "submitting" && navigation.formData?.get("intent") === "friendRequest";
  const isSendingReminder = navigation.state === "submitting" && navigation.formData?.get("intent") === "sendReminder";
  const isSaving = navigation.state === "submitting" && navigation.formData?.get("intent") === "edit";
  const requestSent = actionData?.success === true;
  const friendRequestSent = actionData?.friendRequestSent === true;
  const reminderSent = actionData?.reminderSent === true;
  const refreshResult = actionData?.refreshed !== undefined ? actionData : null;
  const editResult = actionData?.edited !== undefined ? actionData : null;

  // Close edit mode after successful save
  if (editResult?.edited && isEditing && navigation.state === "idle") {
    setIsEditing(false);
  }

  const canRequestBook = !data.isOwner && !data.isBorrowed && !data.isBorrower && data.isFriend;
  const needsFriendship = !data.isOwner && !data.isFriend;

  return (
    <>
    <Breadcrumbs />
    <main className="flex flex-col md:flex-row gap-8 md:gap-12 p-8 w-full max-w-5xl mx-auto mt-4 md:mt-12">
      <section className="order-2 md:order-1 flex-shrink-0">
        <div className="book-cover p-8 md:p-0">
          <BookCover src={data.book.cover} alt={data.book.title} />
        </div>
        {canRequestBook && (
          <Form method="post">
            <input type="hidden" name="intent" value="request" />
            <button
              type="submit"
              disabled={isSubmitting || requestSent}
              className={`mb-4 rounded border-2 w-full mt-8 px-4 py-3 text-base font-medium ${
                requestSent
                  ? "border-green-500 text-green-600 bg-green-50 cursor-default"
                  : isSubmitting
                  ? "border-gray-300 text-gray-400 cursor-wait"
                  : "border-blue-500 text-blue-600 hover:bg-blue-50 focus:bg-blue-100"
              }`}
            >
              {requestSent ? "Request Sent" : isSubmitting ? "Requesting..." : "Request Book"}
            </button>
          </Form>
        )}
        {needsFriendship && data.book.user && (
          <div className="mt-8 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <p className="text-amber-800 dark:text-amber-200 text-sm mb-3">
              Add <span className="font-semibold">{data.book.user.firstname} {data.book.user.surname}</span> as a friend to borrow their books.
            </p>
            <Form method="post">
              <input type="hidden" name="intent" value="friendRequest" />
              <button
                type="submit"
                disabled={isSendingFriendRequest || friendRequestSent}
                className={`rounded w-full px-4 py-2 text-sm font-medium ${
                  friendRequestSent
                    ? "bg-green-500 text-white cursor-default"
                    : isSendingFriendRequest
                    ? "bg-gray-300 text-gray-500 cursor-wait"
                    : "bg-amber-500 text-white hover:bg-amber-600"
                }`}
              >
                {friendRequestSent ? "Friend Request Sent!" : isSendingFriendRequest ? "Sending..." : "Send Friend Request"}
              </button>
            </Form>
          </div>
        )}
        {data.isBorrower && (
          <>
            {data.book.user && (
              <div className={`border rounded-lg p-4 mt-8 ${
                data.book.dueDate && new Date(data.book.dueDate) < new Date()
                  ? "bg-red-50 border-red-200"
                  : "bg-blue-50 border-blue-200"
              }`}>
                <p className={`text-sm ${
                  data.book.dueDate && new Date(data.book.dueDate) < new Date()
                    ? "text-red-800"
                    : "text-blue-800"
                }`}>
                  <span className="font-semibold">Borrowed from:</span>{" "}
                  {data.book.user.firstname} {data.book.user.surname}
                </p>
                {data.book.borrowedAt && (
                  <p className={`text-sm mt-1 ${
                    data.book.dueDate && new Date(data.book.dueDate) < new Date()
                      ? "text-red-700"
                      : "text-blue-700"
                  }`}>
                    <span className="font-semibold">Since:</span>{" "}
                    {new Date(data.book.borrowedAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                )}
                {data.book.dueDate && (
                  <p className={`text-sm mt-1 font-semibold ${
                    new Date(data.book.dueDate) < new Date()
                      ? "text-red-700"
                      : "text-blue-700"
                  }`}>
                    {new Date(data.book.dueDate) < new Date() ? (
                      <>Overdue! Was due {new Date(data.book.dueDate).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}</>
                    ) : (
                      <>Due: {new Date(data.book.dueDate).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}</>
                    )}
                  </p>
                )}
              </div>
            )}
            <Form method="post">
              <input type="hidden" name="intent" value="return" />
              <button
                type="submit"
                className={`mb-4 rounded border-2 border-amber-500 w-full ${data.book.user ? 'mt-4' : 'mt-8'} px-4 py-3 text-base font-medium text-amber-600 hover:bg-amber-50 focus:bg-amber-100`}
              >
                Return Book
              </button>
            </Form>
          </>
        )}
      </section>
      <section className="order-1 md:order-2 flex-1">
        {isEditing ? (
          /* Edit Mode */
          <Form method="post" className="space-y-4">
            <input type="hidden" name="intent" value="edit" />

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Book</h3>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                Cancel
              </button>
            </div>

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
              <input
                type="text"
                id="title"
                name="title"
                defaultValue={data.book.title}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="cover" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cover URL</label>
              <div className="flex gap-3">
                <input
                  type="url"
                  id="cover"
                  name="cover"
                  defaultValue={data.book.cover}
                  placeholder="https://covers.openlibrary.org/..."
                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm"
                />
                {data.book.cover && (
                  <img
                    src={data.book.cover}
                    alt="Current cover"
                    className="w-10 h-14 object-cover rounded border border-gray-200 dark:border-gray-700"
                  />
                )}
              </div>
            </div>

            <div>
              <label htmlFor="author" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Author</label>
              <input
                type="text"
                id="author"
                name="author"
                defaultValue={data.book.author}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label htmlFor="body" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                id="body"
                name="body"
                rows={4}
                defaultValue={data.book.body}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="datePublished" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Year Published</label>
                <input
                  type="text"
                  id="datePublished"
                  name="datePublished"
                  defaultValue={data.book.datePublished || ""}
                  placeholder="e.g. 1984"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="pageCount" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Page Count</label>
                <input
                  type="number"
                  id="pageCount"
                  name="pageCount"
                  defaultValue={data.book.pageCount || ""}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="publisher" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Publisher</label>
              <input
                type="text"
                id="publisher"
                name="publisher"
                defaultValue={data.book.publisher || ""}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="subjects" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subjects</label>
              <input
                type="text"
                id="subjects"
                name="subjects"
                defaultValue={data.book.subjects || ""}
                placeholder="Comma-separated, e.g. Fiction, Adventure, Classic"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={isSaving}
                className={`rounded-lg px-4 py-2 font-medium ${
                  isSaving
                    ? "bg-gray-300 text-gray-500 cursor-wait"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>

            <hr className="my-6" />

            <div className="space-y-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Actions</h4>

              {data.book.openLibraryKey && (
                <a
                  href={`https://openlibrary.org${data.book.openLibraryKey}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm"
                >
                  View on Open Library →
                </a>
              )}

              <div className="flex flex-wrap gap-3">
                <Form method="post">
                  <input type="hidden" name="intent" value="refresh" />
                  <button
                    type="submit"
                    disabled={isRefreshing}
                    className={`rounded-lg border-2 px-4 py-2 text-sm ${
                      isRefreshing
                        ? "border-gray-300 text-gray-400 cursor-wait"
                        : "border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                    }`}
                  >
                    {isRefreshing ? "Refreshing..." : "Refresh from Open Library"}
                  </button>
                </Form>
                <Form method="post">
                  <input type="hidden" name="intent" value="delete" />
                  <button
                    type="submit"
                    className="rounded-lg border-2 border-red-500 px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    Delete Book
                  </button>
                </Form>
              </div>
              {refreshResult && (
                <p className={`text-sm ${refreshResult.refreshed ? "text-green-600" : "text-amber-600"}`}>
                  {refreshResult.message}
                </p>
              )}
            </div>
          </Form>
        ) : (
          /* View Mode */
          <>
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-4xl md:text-5xl font-bold">{data.book.title}</h3>
              {data.isOwner && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex-shrink-0 text-sm px-3 py-1 rounded-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>
            <h4 className="text-3xl md:text-4xl author py-4">{data.book.author}</h4>

            <div className="flex flex-wrap gap-x-6 gap-y-2 py-4 text-sm text-gray-600 dark:text-gray-400">
              {data.book.datePublished && (
                <div>
                  <span className="font-semibold">Published:</span> {data.book.datePublished}
                </div>
              )}
              {data.book.pageCount && (
                <div>
                  <span className="font-semibold">Pages:</span> {data.book.pageCount}
                </div>
              )}
              {data.book.publisher && (
                <div>
                  <span className="font-semibold">Publisher:</span> {data.book.publisher}
                </div>
              )}
              {!data.isOwner && data.book.user && (
                <div>
                  <span className="font-semibold">Owner:</span> {data.book.user.firstname} {data.book.user.surname}
                </div>
              )}
            </div>

            {data.book.subjects && (
              <div className="py-2">
                <div className="flex flex-wrap gap-2">
                  {data.book.subjects.split(", ").map((subject, index) => (
                    <span
                      key={index}
                      className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs px-3 py-1 rounded-full"
                    >
                      {subject}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!isEditing && data.isOwner && data.isBorrowed && data.book.borrower && (() => {
          const dueDate = data.book.dueDate ? new Date(data.book.dueDate) : null;
          const now = new Date();
          const isOverdue = dueDate && dueDate < now;
          const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

          return (
            <div className={`border rounded-lg p-4 my-4 ${isOverdue ? "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800" : "bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800"}`}>
              <p className={isOverdue ? "text-red-800 dark:text-red-200" : "text-amber-800 dark:text-amber-200"}>
                <span className="font-semibold">Currently lent to:</span>{" "}
                <span className={isOverdue ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}>{data.book.borrower.firstname} {data.book.borrower.surname}</span>
              </p>
              {data.book.borrowedAt && (
                <p className={`text-sm mt-1 ${isOverdue ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}`}>
                  <span className="font-semibold">Since:</span>{" "}
                  {new Date(data.book.borrowedAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
              {dueDate && (
                <p className={`text-sm mt-1 font-semibold ${isOverdue ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}`}>
                  {isOverdue ? (
                    <>Overdue by {Math.abs(daysLeft!)} {Math.abs(daysLeft!) === 1 ? "day" : "days"}</>
                  ) : daysLeft !== null && daysLeft <= 3 ? (
                    <>Due in {daysLeft} {daysLeft === 1 ? "day" : "days"} — reminder will be sent</>
                  ) : (
                    <>Due in {daysLeft} days ({dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })})</>
                  )}
                </p>
              )}
              <Form method="post" className="mt-3">
                <input type="hidden" name="intent" value="sendReminder" />
                <button
                  type="submit"
                  disabled={isSendingReminder || reminderSent}
                  className={`text-sm px-3 py-1.5 rounded ${
                    reminderSent
                      ? "bg-green-500 text-white cursor-default"
                      : isSendingReminder
                      ? "bg-gray-300 text-gray-500 cursor-wait"
                      : isOverdue
                      ? "bg-red-600 text-white hover:bg-red-700"
                      : "bg-amber-600 text-white hover:bg-amber-700"
                  }`}
                >
                  {reminderSent ? "Reminder Sent!" : isSendingReminder ? "Sending..." : "Send Return Reminder"}
                </button>
              </Form>
            </div>
          );
        })()}

        {!isEditing && (
          <div className="py-4">
            <h5 className="font-semibold text-lg mb-2">Description</h5>
            <p className="summary text-gray-700 dark:text-gray-300 leading-relaxed">{data.book.body || "No description available."}</p>
          </div>
        )}

        {!isEditing && data.lendingHistory && data.lendingHistory.length > 0 && (
          <div className="py-4">
            <h5 className="font-semibold text-lg mb-3 flex items-center gap-2">
              <HistoryIcon size={20} className="text-gray-400" />
              Lending History
            </h5>
            <ul className="space-y-1">
              {data.lendingHistory.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 font-semibold text-xs flex-shrink-0">
                      {entry.isCurrentUser ? (
                        data.currentUser?.profileEmoji ? (
                          <span className="text-lg">{data.currentUser.profileEmoji}</span>
                        ) : (
                          <>
                            {(data.currentUser?.firstname?.[0] || "").toUpperCase()}
                            {(data.currentUser?.surname?.[0] || "").toUpperCase()}
                          </>
                        )
                      ) : entry.borrower.profileEmoji ? (
                        <span className="text-lg">{entry.borrower.profileEmoji}</span>
                      ) : (
                        <>
                          {(entry.borrower.firstname?.[0] || "").toUpperCase()}
                          {(entry.borrower.surname?.[0] || "").toUpperCase()}
                        </>
                      )}
                    </div>
                    {entry.isCurrentUser ? (
                      <span className="font-medium text-gray-900 dark:text-gray-100">You</span>
                    ) : entry.isFriend ? (
                      <Link
                        to={`/friend/${entry.borrower.id}`}
                        className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {entry.borrower.firstname} {entry.borrower.surname}
                      </Link>
                    ) : entry.borrower.shareToken ? (
                      <Link
                        to={`/shelf/${entry.borrower.shareToken}`}
                        className="font-medium text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {entry.borrower.firstname} {entry.borrower.surname}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{entry.borrower.firstname} {entry.borrower.surname}</span>
                        <Form method="post" className="inline">
                          <input type="hidden" name="intent" value="friendRequest" />
                          <input type="hidden" name="targetUserId" value={entry.borrower.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700"
                            title="Add as friend to view their shelf"
                          >
                            <PersonAddIcon size={14} />
                            <span>Add friend</span>
                          </button>
                        </Form>
                      </div>
                    )}
                  </div>
                  <div className="text-gray-400 text-xs">
                    {new Date(entry.borrowedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {entry.returnedAt && (
                      <span> — {new Date(entry.returnedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    )}
                    {!entry.returnedAt && (
                      <span className="ml-2 text-amber-600">Current</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

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
