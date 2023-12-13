import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, NavLink, Outlet, useLoaderData } from "@remix-run/react";
import { getBookListItems } from "~/models/book.server";
import { requireUserId } from "~/session.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const bookListItems = await getBookListItems({ userId });
  return json({ bookListItems });
}

export default function BooksPage() {
  const data = useLoaderData<typeof loader>();

  return (
    <div className="flex h-full min-h-screen flex-col">
      <main>
        {data.bookListItems.length === 0 ? (
          <p className="p-4">No books yet</p>
        ) : (
          <ol className="grid grid-cols-8 gap-4">
            {data.bookListItems.map((book) => (
              <li key={book.id}>
                <NavLink to={book.id}>
                  {book.cover ? (  
                    <img className="w-full rounded-md shadow-md" src={book.cover}></img> 
                  ): ( 
                    <article className="no-cover rounded-md shadow-md">
                      <h3>{book.title}</h3>
                    </article>
                  )}
                </NavLink>
              </li>
            ))}
          </ol>
        )}
        <Outlet />
      </main>
    </div>
  );
}
