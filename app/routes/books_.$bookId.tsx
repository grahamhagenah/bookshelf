import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, isRouteErrorResponse, Link, useLoaderData, useRouteError, useNavigation, useActionData } from "@remix-run/react";
import invariant from "tiny-invariant";
import { useState } from "react";
import { deleteBook, getBookById, returnBook, updateBookMetadata } from "~/models/book.server";
import { getUserById, getUserEmailById, createBookRequestNotification, createBookReturnedNotification } from "~/models/user.server";
import { sendBookRequestEmail } from "~/email.server";
import { requireUserId } from "~/session.server";
import Breadcrumbs from "~/components/breadcrumbs";

function BookCover({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="relative inline-block">
      {!loaded && (
        <div className="rounded-lg bg-blue-100 opacity-50" style={{ width: 200, height: 300 }} />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className={`rounded-lg shadow-xl h-[300px] ${loaded ? 'opacity-100' : 'opacity-0'} ${!loaded ? 'absolute top-0 left-0' : ''} transition-opacity duration-300`}
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

  // If not the owner, check if the owner is a friend or borrower
  if (!isOwner && !isBorrower) {
    const followingIds = currentUser?.following?.map(friend => friend.id) ?? [];
    const isFriend = followingIds.includes(book.userId);

    if (!isFriend) {
      throw new Response("Not Found", { status: 404 });
    }
  }

  return json({ book, isOwner, isBorrowed, isBorrower, currentUser });
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

    // Send email notification to book owner
    const bookOwner = await getUserEmailById(book.userId);
    if (bookOwner) {
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

  return null;
};

export default function BookDetailsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as { success?: boolean; refreshed?: boolean; message?: string } | null;
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting" && navigation.formData?.get("intent") === "request";
  const isRefreshing = navigation.state === "submitting" && navigation.formData?.get("intent") === "refresh";
  const requestSent = actionData?.success === true;
  const refreshResult = actionData?.refreshed !== undefined ? actionData : null;

  const canRequestBook = !data.isOwner && !data.isBorrowed && !data.isBorrower;
  const showBorrowedStatus = data.isBorrowed;

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
        {data.isBorrower && (
          <>
            {data.book.user && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-8">
                <p className="text-blue-800 text-sm">
                  <span className="font-semibold">Borrowed from:</span>{" "}
                  {data.book.user.firstname} {data.book.user.surname}
                </p>
                {data.book.borrowedAt && (
                  <p className="text-blue-700 text-sm mt-1">
                    <span className="font-semibold">Since:</span>{" "}
                    {new Date(data.book.borrowedAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
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
        {showBorrowedStatus && !data.isBorrower && (
          <p className="mt-8 text-center text-gray-600">
            This book is currently borrowed
          </p>
        )}
      </section>
      <section className="order-1 md:order-2 flex-1">
        <h3 className="text-4xl md:text-5xl font-bold">{data.book.title}</h3>
        <h4 className="text-3xl md:text-4xl author py-4">{data.book.author}</h4>

        <div className="flex flex-wrap gap-x-6 gap-y-2 py-4 text-sm text-gray-600">
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
                  className="bg-gray-100 text-gray-700 text-xs px-3 py-1 rounded-full"
                >
                  {subject}
                </span>
              ))}
            </div>
          </div>
        )}

        {data.isOwner && data.isBorrowed && data.book.borrower && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 my-4">
            <p className="text-amber-800">
              <span className="font-semibold">Currently lent to:</span>{" "}
              <span className="text-amber-700">{data.book.borrower.firstname} {data.book.borrower.surname}</span>
            </p>
            {data.book.borrowedAt && (
              <p className="text-amber-700 text-sm mt-1">
                <span className="font-semibold">Since:</span>{" "}
                {new Date(data.book.borrowedAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            )}
          </div>
        )}

        <div className="py-4">
          <h5 className="font-semibold text-lg mb-2">Description</h5>
          <p className="summary text-gray-700 leading-relaxed">{data.book.body || "No description available."}</p>
        </div>

        {data.book.openLibraryKey && (
          <div className="py-2">
            <a
              href={`https://openlibrary.org${data.book.openLibraryKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              View on Open Library
            </a>
          </div>
        )}

        {data.isOwner && (
          <>
            <hr className="my-4" />
            <div className="flex flex-wrap gap-3 items-center">
              <Form method="post">
                <input type="hidden" name="intent" value="refresh" />
                <button
                  type="submit"
                  disabled={isRefreshing}
                  className={`rounded border-2 px-4 py-2 ${
                    isRefreshing
                      ? "border-gray-300 text-gray-400 cursor-wait"
                      : "border-green-600 text-green-600 hover:bg-green-50 focus:bg-green-100"
                  }`}
                >
                  {isRefreshing ? "Refreshing..." : "Refresh from Open Library"}
                </button>
              </Form>
              <Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <button
                  type="submit"
                  className="rounded border-2 border-red-500 px-4 py-2 text-red-500 hover:bg-red-50 focus:bg-red-100"
                >
                  Delete
                </button>
              </Form>
            </div>
            {refreshResult && (
              <p className={`mt-3 text-sm ${refreshResult.refreshed ? "text-green-600" : "text-amber-600"}`}>
                {refreshResult.message}
              </p>
            )}
          </>
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
