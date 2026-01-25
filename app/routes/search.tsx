import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { Form } from "@remix-run/react";
import { createBook } from "~/models/book.server";
import { requireUserId } from "~/session.server";
import Breadcrumbs from "~/components/breadcrumbs";

export const handle = {
  breadcrumb: () => <span>Search</span>,
};

interface OpenLibraryBook {
  title: string;
  author_name?: string[];
  cover_i?: number;
  first_sentence?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  subject?: string[];
  publisher?: string[];
  key?: string;
}

interface OpenLibraryResponse {
  docs: OpenLibraryBook[];
}

// Make GET request to Open Library API
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const queryParams = url.searchParams;
  const queryValue = queryParams.get('q');

  // Explicitly request the fields we need
  const fields = [
    'title',
    'author_name',
    'cover_i',
    'first_sentence',
    'first_publish_year',
    'number_of_pages_median',
    'subject',
    'publisher',
    'key'
  ].join(',');

  const res = await fetch(
    `https://openlibrary.org/search.json?q=${queryValue}&limit=10&fields=${fields}`
  );
  return json(await res.json() as OpenLibraryResponse);
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const userId = await requireUserId(request);

  const formData = await request.formData();
  const title = formData.get("title");
  const author = formData.get("author");
  const coverId = formData.get("cover");
  const cover = "https://covers.openlibrary.org/b/id/" + (coverId ?? "") + "-M.jpg";
  const body = formData.get("body");
  const datePublished = formData.get("datePublished");
  const pageCount = formData.get("pageCount");
  const subjects = formData.get("subjects");
  const publisher = formData.get("publisher");
  const openLibraryKey = formData.get("openLibraryKey");

  await createBook({
    title: typeof title === "string" ? title : "",
    author: typeof author === "string" ? author : "",
    body: typeof body === "string" ? body : "",
    cover,
    datePublished: typeof datePublished === "string" && datePublished.length > 0 ? datePublished : null,
    pageCount: typeof pageCount === "string" && pageCount.length > 0 ? parseInt(pageCount, 10) : null,
    subjects: typeof subjects === "string" && subjects.length > 0 ? subjects : null,
    publisher: typeof publisher === "string" && publisher.length > 0 ? publisher : null,
    openLibraryKey: typeof openLibraryKey === "string" && openLibraryKey.length > 0 ? openLibraryKey : null,
    userId,
  });

  return redirect(`/books`);
};

export default function Search() {
  const results = useLoaderData<typeof loader>();

  return (
    <>
    <Breadcrumbs />
    <div id="search-container" className="w-3/4 lg:w-1/2 mx-auto mt-4">
      <ul className="search-results mb-4">
        {results?.docs?.map((book, index) => {
          const subjectsPreview = book.subject?.slice(0, 3).join(", ") ?? "";
          return (
            <li key={index} className="border-b border-gray-200 last:border-0">
              <Form method="post" className="grid grid-cols-1 md:grid-cols-[1fr,3fr]">
                <section className="w-full p-4">
                  <div className="book-cover">
                    <img
                      className="rounded-md shadow-md"
                      src={"https://covers.openlibrary.org/b/id/" + book.cover_i + "-M.jpg"}
                      alt={book.title}
                    />
                  </div>
                </section>
                <section className="w-full p-4">
                  <h3 className="text-3xl font-bold">{book.title}</h3>
                  <h4 className="text-xl py-2 text-gray-700">{book.author_name?.[0] ?? "Unknown Author"}</h4>

                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 py-2">
                    {book.first_publish_year && (
                      <span>Published: {book.first_publish_year}</span>
                    )}
                    {book.number_of_pages_median && (
                      <span>{book.number_of_pages_median} pages</span>
                    )}
                    {book.publisher?.[0] && (
                      <span>{book.publisher[0]}</span>
                    )}
                  </div>

                  {subjectsPreview && (
                    <p className="text-sm text-gray-500 py-1">{subjectsPreview}</p>
                  )}

                  <p className="summary py-4 text-gray-700">
                    {book.first_sentence ? book.first_sentence[0] : "No description available."}
                  </p>

                  <input type="hidden" name="title" value={book.title ?? ""} />
                  <input type="hidden" name="author" value={book.author_name?.[0] ?? ""} />
                  <input type="hidden" name="cover" value={book.cover_i ?? ""} />
                  <input type="hidden" name="body" value={book.first_sentence?.[0] ?? ""} />
                  <input type="hidden" name="datePublished" value={book.first_publish_year?.toString() ?? ""} />
                  <input type="hidden" name="pageCount" value={book.number_of_pages_median?.toString() ?? ""} />
                  <input type="hidden" name="subjects" value={book.subject?.slice(0, 5).join(", ") ?? ""} />
                  <input type="hidden" name="publisher" value={book.publisher?.[0] ?? ""} />
                  <input type="hidden" name="openLibraryKey" value={book.key ?? ""} />

                  <button className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:bg-blue-400" type="submit">
                    Add to Library
                  </button>
                </section>
              </Form>
            </li>
          );
        })}
      </ul>
    </div>
    </>
  );
}