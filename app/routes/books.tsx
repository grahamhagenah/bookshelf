import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, Link, NavLink, Outlet, useLoaderData } from "@remix-run/react";

import { getBookListItems } from "~/models/book.server";
import { requireUserId } from "~/session.server";
import { useUser } from "~/utils";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const bookListItems = await getBookListItems({ userId });
  return json({ bookListItems });
};

export default function BooksPage() {
  const data = useLoaderData<typeof loader>();
  const user = useUser();

  return (
    <div className="flex h-full min-h-screen flex-col">
      <header className="flex items-center justify-between bg-slate-800 p-4 text-white">
        <h1 className="text-3xl font-bold">
          <Link to=".">Lend</Link>
        </h1>
        <p>{user.email}</p>
        <Form action="/logout" method="post">
          <button
            type="submit"
            className="rounded bg-slate-600 px-4 py-2 text-blue-100 hover:bg-blue-500 active:bg-blue-600"
          >
            Logout
          </button>
        </Form>
      </header>

      <main>
        <div>
          <Link to="/books/new" className="block p-4 text-xl text-blue-500">
            + New Book
          </Link>

          <hr />

          {data.bookListItems.length === 0 ? (
            <p className="p-4">No books yet</p>
          ) : (
            <ol>
              {data.bookListItems.map((book) => (
                <li key={book.id}>
                  <NavLink to={book.id}>
                    <img src={book.cover}></img>
                  </NavLink>
                </li>
              ))}
            </ol>
          )}
        </div>
        <Outlet />
      </main>
    </div>
  );
}
