import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Form } from "@remix-run/react";
import type { ActionFunctionArgs } from "@remix-run/node";
import { createBook } from "~/models/book.server";
import { requireUserId } from "~/session.server";

// Make GET request to Open Library API
export async function loader({ request }) {
  
  const url = new URL(request.url)
  const queryParams = url.searchParams
  const queryValue = queryParams.get('q')
  const res = await fetch(`https://openlibrary.org/search.json?q=${queryValue}&limit=10`)
  return json(await res.json())
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);

  const formData = await request.formData();
  const title = formData.get("title");
  const author = formData.get("author");
  const cover = "https://covers.openlibrary.org/b/id/" + formData.get("cover") + "-L.jpg"
  const body = formData.get("body");

  await createBook({ title, author, body, cover, userId });

  return redirect(`/books`);
};

export default function Search() {

  const results = useLoaderData();

  return (
    <div id="search-container">
      <ul className="search-results mb-4">
        {results ? results.docs.map((book, index) => 
          <li key={index}>
            <Form method="post">
              <section>
                  <div className="book-cover">
                  <img className="rounded-md shadow-md" src={"https://covers.openlibrary.org/b/id/" + book.cover_i + "-M.jpg"}></img>
                </div>
              </section>
              <section>
                <h3 className="text-4xl font-bold">{book.title}</h3>
                <p className="author py-6">{book.author_name}</p>
                <p className="summary py-6">{book.first_sentence ? book.first_sentence[0] : ''}</p>
                <input type="hidden" name="title" value={book.title} />
                <input type="hidden" name="author" value={book.author_name} />
                <input type="hidden" name="cover" value={book.cover_i} />
                <input type="hidden" name="body" value={book.first_sentence ? book.first_sentence[0] : ''} />
                <button className="w-half rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400" type="submit">Add book to shelf</button>
              </section>
            </Form>
          </li>) 
        : null}
      </ul>
    </div>
  );
}