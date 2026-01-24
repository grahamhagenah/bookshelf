import { NavLink } from "@remix-run/react";
import ProgressiveImage from "react-progressive-graceful-image";
import GroupIcon from '@mui/icons-material/Group';
import SearchIcon from '@mui/icons-material/Search';
import ImportContactsIcon from '@mui/icons-material/ImportContacts';

interface Book {
  id: string;
  title: string;
  cover: string;
  isBorrowed?: boolean;
  isLending?: boolean;
}

interface LibraryProps {
  bookListItems: Book[];
}

export default function Library({ bookListItems }: LibraryProps) {

  return (
    <>
    {bookListItems.length === 0 ? (
    <main className="md:h-4/6 flex flex-col justify-center">
        <section id="intro">
          <div className="intro-wrapper">
            <h1 className="text-4xl md:text-6xl font-semibold mt-5">This is your <strong>lending library</strong></h1>
            <ol className="card-wrapper md:flex justify-center mx-auto mt-10 text-xl md:w-3/4">
              <li className="md:w-1/3 m-4 xl:m-8 rounded-xl">
                <SearchIcon />
                <p className="mt-5">Search for books by author or title</p>
              </li>
              <li className="md:w-1/3 m-4 xl:m-8 rounded-xl">
                <GroupIcon />
                <p className="mt-5">Add friends to see their books</p>
              </li>
              <li className="md:w-1/3 m-4 xl:m-8 rounded-xl">
                <ImportContactsIcon />
                <p className="mt-5">Start borrowing and lending</p>
              </li>
            </ol>
          </div>
        </section>
      </main>
      ) : (
      <main className="mt-8 md:mt-8 px-4 md:px-8 pb-8">
        <ol className="grid grid-cols-2 gap-4 sm::grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 2xl:grid-cols-8">
          {bookListItems.map((book) => (
            <li key={book.id} className="cover-wrapper relative">
              <NavLink to={`/books/${book.id}`}>
                <ProgressiveImage src={book.cover} placeholder="">
                  {(src, loading) => {
                    return loading ? <div className="rounded-lg" style={{ opacity: 0.5, backgroundColor: '#D4F5FF', height: 320 }}/>
                    : <img height="320" className="rounded-lg shadow-xl book-cover h-80" src={src} alt={book.title} />;
                  }}
                </ProgressiveImage>
                {book.isBorrowed && (
                  <span className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full shadow">
                    Borrowed
                  </span>
                )}
                {book.isLending && (
                  <span className="absolute top-2 right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full shadow">
                    Lending
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ol>
      </main>
    )}
  </>
  );
}