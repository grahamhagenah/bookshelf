
import { Form, Link } from "@remix-run/react";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs } from "@remix-run/node";

const apiUrl = 'https://openlibrary.org/search.json';

// export async function loader() {
//   const searchTerm = "lord of the rings"; // Assuming you're passing the search term as a URL parameter
//   const res = await fetch(`${apiUrl}?q=${searchTerm}`);
//   console.log(`${apiUrl}?q=${searchTerm}`)
//   // return json(await res.json());
//   return json({ name: "Ryan", date: new Date() });
// }

export async function loader() {
  const res = await fetch("https://openlibrary.org/search.json?q=the+lord+of+the+rings");
  return json(await res.json());
}

// export async function loader() {
//   const res = await fetch("https://api.github.com/gists");
//   return json(await res.json());
// }


export default function Header() {

  const gists = useLoaderData<typeof loader>();
  console.log(gists)
  // const gists = useLoaderData<typeof loader>();
  // console.log(gists)
  // const searchResults = useLoaderData<typeof loader>();
  // console.log(searchResults)

  return (
    <header className="w-full flex items-center justify-between">
      {/* <ul>
      {gists.map((gist) => (
        <li key={gist.id}>
          <a href={gist.html_url}>{gist.id}</a>
        </li>
      ))}
    </ul> */}
      <h1 className="text-3xl font-bold">
        <Link to="/books">Lend</Link>
      </h1>
      <div className="search-container">
        <input type="text" id="search-input" placeholder="Search..."></input>
        <div id="suggestions-container"></div>
      </div>
      <Form action="/logout" method="post">
        <button
          type="submit"
          className="rounded bg-slate-600 px-4 py-2 text-blue-100 hover:bg-blue-500 active:bg-blue-600"
        >
          Logout
        </button>
      </Form>
    </header>
)}