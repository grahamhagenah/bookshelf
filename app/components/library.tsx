import { NavLink } from "@remix-run/react";
import ProgressiveImage from "react-progressive-graceful-image";
import GroupIcon from '@mui/icons-material/Group';
import SearchIcon from '@mui/icons-material/Search';
import ImportContactsIcon from '@mui/icons-material/ImportContacts';
import { useRouteLoaderData } from "@remix-run/react";
import { useMatches } from "@remix-run/react";


export default function Library() {

  const matches = useMatches();
  console.log("matchesss")
  console.log(matches[1])

  return (
    <>
    <h1 className="text-5xl mt-4">{matches[1].data.data.user.firstname}</h1>
    {matches[1].data.data.bookListItems.length === 0 ? (
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
          {matches[1].data.data.bookListItems.map((book) => (
            <li key={book.id} className="cover-wrapper">
              <NavLink to={book.id}>
                <ProgressiveImage src={book.cover} placeholder="">
                  {(src, loading) => {
                    return loading ? <div className="rounded-lg" style={{ opacity: 0.5, backgroundColor: '#D4F5FF', height: 340, width: 214 }}/> 
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