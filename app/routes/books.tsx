import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { NavLink, Outlet, useLoaderData } from "@remix-run/react";
import { getBookListItems } from "~/models/book.server";
import { requireUserId } from "~/session.server";
import ProgressiveImage from "react-progressive-graceful-image";
import Search from "~/components/search"
import type { ActionFunctionArgs } from "@remix-run/node";
import { createBook } from "~/models/book.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const bookListItems = await getBookListItems({ userId });
  return json({ bookListItems });
}

export default function BooksPage() {
  const data = useLoaderData<typeof loader>();

  const dominantImageColor = '#D4F5FF'

  return (
    <div className="flex h-full min-h-screen flex-col">
      <main>
        {data.bookListItems.length === 0 ? (
          <section id="intro" className="flex content-center flex-wrap items-center">
            <div className="intro-wrapper">
              <h2 className="text-6xl font-semibold">Welcome to <strong>Lend</strong></h2>
              <p className="max-w-md mx-auto mt-10 text-xl">Add books to your library by searching titles, authors, or anything else in the search form.</p>
            </div>
          </section>
          ) : (
          <ol className="grid grid-cols-8 gap-5">
            {data.bookListItems.map((book) => (
              <li key={book.id} className="cover-wrapper">
                <NavLink to={book.id}>
                  <ProgressiveImage delay={500} src={book.cover} placeholder="">
                    {(src, loading) => {
                      return loading ? <div className="rounded-lg" style={{ opacity: 0.5, backgroundColor: dominantImageColor, height: 340, width: 214 }}/> 
                      : <img height="340" className="rounded-lg shadow-xl book-cover" src={src} alt={book.title} />;
                    }}
                  </ProgressiveImage>
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
