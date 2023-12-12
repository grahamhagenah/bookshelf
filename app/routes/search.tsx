import { LoaderFunction, json } from "@remix-run/node"; // or cloudflare/deno
import { useLoaderData } from "@remix-run/react";
import React, { useState } from 'react';

// Make GET request to Open Library API
export async function loader({ request }) {

  const url = new URL(request.url)
  const queryParams = url.searchParams
  const queryValue = queryParams.get('query')
  const res = await fetch(`https://openlibrary.org/search.json?title=${queryValue}`)
  return json(await res.json())

}

export default function Search() {

  const results = useLoaderData();
  console.log(results)

  return (
    <div className="search-container">
      <form>
        <input type="text" name="query" placeholder="Search books..." />
      </form>
      <ul id="search-results">
        <li>{(results) && results.docs[0].title}</li>
        <li>{(results) && results.docs[0].author_name}</li>
        <li>{(results) && results.docs[0].first_publish_year}</li>
        {/* {results.map((result) => (
          <li key={result.id}>
            <a href={result.html_url}>{result.id}</a>
          </li>
        ))} */}
      </ul>
    </div>
  );
}