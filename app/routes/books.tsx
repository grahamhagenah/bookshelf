import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { NavLink, Outlet, useLoaderData } from "@remix-run/react";
import { getBookListItems } from "~/models/book.server";
import { requireUserId } from "~/session.server";
import ProgressiveImage from "react-progressive-graceful-image";
import { createBook } from "~/models/book.server";
import GroupIcon from '@mui/icons-material/Group';
import SearchIcon from '@mui/icons-material/Search';
import ImportContactsIcon from '@mui/icons-material/ImportContacts';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await requireUserId(request);
  const bookListItems = await getBookListItems({ userId });

  const data = {
    userId,
    bookListItems,
  };

  return json({data});
}

export default function BooksPage() {
  const data = useLoaderData<typeof loader>();

  const dominantImageColor = '#D4F5FF'

  return (
    <>
    {data.data.bookListItems.length === 0 ? (
    <main className="h-4/6 flex flex-col justify-center">
        <section id="intro">
          <div className="intro-wrapper">
            <h2 className="text-6xl font-semibold mt-5">This is your <strong>lending library</strong></h2>
            <ol className="card-wrapper mx-auto mt-10 text-xl">
              <li>
                <SearchIcon />
                <p className="mt-5">Search for books by author or title</p>
              </li>
              <li>
                <GroupIcon />
                <p className="mt-5">Add friends to see their books</p>
              </li>
              <li>
                <ImportContactsIcon />
                <p className="mt-5">Start borrowing and lending</p>
              </li>
            </ol>
          </div>
        </section>
      </main>
      ) : (
      <main>
        <ol className="grid grid-cols-8 gap-5">
          {data.data.bookListItems.map((book) => (
            <li key={book.id} className="cover-wrapper">
              <NavLink to={book.id}>
                <ProgressiveImage src={book.cover} placeholder="">
                  {(src, loading) => {
                    return loading ? <div className="rounded-lg" style={{ opacity: 0.5, backgroundColor: dominantImageColor, height: 340, width: 214 }}/> 
                    : <img height="340" className="rounded-lg shadow-xl book-cover" src={src} alt={book.title} />;
                  }}
                </ProgressiveImage>
              </NavLink>
            </li>
          ))}
        </ol>
      </main>
    )}
  </>
  );
}
