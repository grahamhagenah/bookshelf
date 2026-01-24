import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, isRouteErrorResponse, useLoaderData, useRouteError, useNavigation, useActionData } from "@remix-run/react";
import invariant from "tiny-invariant";
import { deleteBook, getBookById, returnBook } from "~/models/book.server";
import { getUserById, createBookRequestNotification, createBookReturnedNotification } from "~/models/user.server";
import { requireUserId } from "~/session.server";
import ProgressiveImage from "react-progressive-graceful-image";

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

  // If not the owner, check if the owner is a friend or borrower
  if (!isOwner && !isBorrower) {
    const currentUser = await getUserById(userId);
    const isFriend = currentUser?.following.some(friend => friend.id === book.userId) ?? false;

    if (!isFriend) {
      throw new Response("Not Found", { status: 404 });
    }
  }

  const currentUser = await getUserById(userId);

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

  return null;
};

export default function BookDetailsPage() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting" && navigation.formData?.get("intent") === "request";
  const requestSent = actionData?.success === true;

  const canRequestBook = !data.isOwner && !data.isBorrowed && !data.isBorrower;
  const showBorrowedStatus = data.isBorrowed;

  return (
    <main className="grid grid-cols-1 md:grid-cols-[1fr,2fr] gap-4 md:gap-16 p-8 w-full lg:w-3/4 xl:w-1/2 mx-auto mt-4 md:mt-12">
      <section className="order-2 md:order-1">
        <div className="book-cover p-8 md:p-0">
          <ProgressiveImage src={data.book.cover} placeholder="">
            {(src, loading) => {
              return loading ? <div className="rounded-lg" style={{ opacity: 0.5, backgroundColor: '#D4F5FF', height: 384 }}/>
              : <img height="384" className="rounded-lg shadow-xl book-cover h-96" src={src} alt={data.book.title} />;
            }}
          </ProgressiveImage>
        </div>
        {canRequestBook && (
          <Form method="post">
            <input type="hidden" name="intent" value="request" />
            <button
              type="submit"
              disabled={isSubmitting || requestSent}
              className={`mb-4 rounded border w-full mt-8 px-4 py-3 text-base font-medium shadow-sm ${
                requestSent
                  ? "bg-green-100 text-green-700 cursor-default"
                  : isSubmitting
                  ? "bg-gray-100 text-gray-500 cursor-wait"
                  : "bg-white text-black-700 hover:bg-slate-50 focus:bg-slate-100"
              }`}
            >
              {requestSent ? "Request Sent" : isSubmitting ? "Requesting..." : "Request Book"}
            </button>
          </Form>
        )}
        {data.isBorrower && (
          <Form method="post">
            <input type="hidden" name="intent" value="return" />
            <button
              type="submit"
              className="mb-4 rounded border w-full mt-8 bg-amber-500 px-4 py-3 text-base font-medium text-white shadow-sm hover:bg-amber-600 focus:bg-amber-700"
            >
              Return Book
            </button>
          </Form>
        )}
        {showBorrowedStatus && !data.isBorrower && (
          <p className="mt-8 text-center text-gray-600">
            This book is currently borrowed
          </p>
        )}
      </section>
      <section className="order-1 md:order-2">
        <h3 className="text-4xl md:text-5xl font-bold">{data.book.title}</h3>
        <h4 className="text-3xl md:text-4xl author py-6">{data.book.author}</h4>
        <p className="summary py-6">{data.book.body}</p>
        {data.isOwner && (
          <>
            <hr className="my-4" />
            <Form method="post">
              <input type="hidden" name="intent" value="delete" />
              <button
                type="submit"
                className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400"
              >
                Delete
              </button>
            </Form>
          </>
        )}
      </section>
    </main>
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
