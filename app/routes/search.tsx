import { LoaderFunction, json, redirect } from "@remix-run/node"; // or cloudflare/deno
import { useLoaderData } from "@remix-run/react";
import React, { useState } from 'react';
import { Form, useActionData } from "@remix-run/react";
import type { ActionFunctionArgs } from "@remix-run/node";
import { createBook } from "~/models/book.server";
import { requireUserId } from "~/session.server";

// Make GET request to Open Library API
export async function loader({ request }) {

  const url = new URL(request.url)
  const queryParams = url.searchParams
  const queryValue = queryParams.get('query')
  const res = await fetch(`https://openlibrary.org/search.json?q=${queryValue}`)
  return json(await res.json())
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);

  const formData = await request.formData();
  const title = formData.get("title");
  const author = formData.get("author");
  const cover = "https://covers.openlibrary.org/b/id/" + formData.get("cover") + "-L.jpg"
  const body = formData.get("first_sentence");

  const book = await createBook({ title, author, body, cover, userId });

  return redirect(`/books/${book.id}`);
};

export default function Search() {

  const results = useLoaderData();

  console.log(results.docs[0])

  return (
    <div className="search-container">
      <ul id="search-results">
        {results ? results.docs.map((book, index) => 
          <li key={index}>
            <Form method="post">
              <h3>{book.title}</h3>
              <p>{book.author_name}</p>
              <img src={"https://covers.openlibrary.org/b/id/" + book.cover_i + "-S.jpg"}></img>
              <p>OLID: {book.olid}</p>
              <input type="hidden" name="title" value={book.title} />
              <input type="hidden" name="author" value={book.author_name} />
              {book.first_sentence ? <input type="hidden" name="first_sentence" value={book.first_sentence[0]} /> : null}
              <input type="hidden" name="first_sentence" value={book.first_sentence} />
              <input type="hidden" name="cover" value={book.cover_i} />
              <button type="submit">Add book</button>
            </Form>
          </li>) 
        : null}
      </ul>
    </div>
  );
}