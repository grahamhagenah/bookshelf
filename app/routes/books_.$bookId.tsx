import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import {
  Form,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import invariant from "tiny-invariant";

import { deleteBook, getBook } from "~/models/book.server";
import { requireUserId } from "~/session.server";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  invariant(params.bookId, "bookId not found");

  const book = await getBook({ id: params.bookId, userId });
  if (!book) {
    throw new Response("Not Found", { status: 404 });
  }
  return json({ book });
};

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);
  invariant(params.bookId, "bookId not found");

  await deleteBook({ id: params.bookId, userId });

  return redirect("/books");
};

export default function BookDetailsPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <main id="book-details">
      <section>
        <div className="book-cover">
          <img className="rounded-md shadow-md" src={data.book.cover}></img>
          <div className="button-group">
            <button className="shadow-sm">Borrow</button>
            <button className="shadow-sm">Add to your shelf</button>
          </div>
        </div>
      </section>
      <section>
        <h3 className="text-5xl font-bold">{data.book.title}</h3>
        <p className="summary py-6">{data.book.body}</p>
        <hr className="my-4" />
        <Form method="post">
          <button
            type="submit"
            className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400"
          >
            Delete
          </button>
        </Form>
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
