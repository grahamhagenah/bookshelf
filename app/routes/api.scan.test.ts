// @vitest-environment node
import { isbnForms } from "~/isbn";
import { sessionStorage } from "~/session.server";

import { makeBook, makeUser, prisma } from "../../test/db";
import { bodyOf, routeArgs, statusOf } from "../../test/route";

import { action } from "./api.scan";
import type { ScanResponse } from "./api.scan";

async function scan(userId: string, isbn: string) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  const result = await action(
    routeArgs(
      new Request("http://localhost/api/scan", {
        method: "POST",
        headers: { Cookie: await sessionStorage.commitSession(session) },
        body: new URLSearchParams({ isbn }),
      }),
    ),
  );
  return { status: statusOf(result), body: (await bodyOf(result)) as ScanResponse };
}

// An ISBN no other test has, and Open Library counting its calls
const anIsbn = () => `978${String(Math.random()).slice(2, 12)}`;

function stubOpenLibrary(docs: unknown[] = []) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: string | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ docs }), { status: 200 });
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("a book someone in Stacks has is added from their copy, without asking Open Library", async () => {
  const isbn = anIsbn();
  const key = `/works/OL${crypto.randomUUID().slice(0, 8)}W`;
  // Saved under the older, 10-digit way of writing the ISBN
  const theirs = await makeBook((await makeUser("Priya")).id, "Piranesi");
  await prisma.book.update({
    where: { id: theirs.id },
    data: {
      isbn: isbnForms(isbn)[1],
      openLibraryKey: key,
      author: "Susanna Clarke",
      cover: "https://covers.openlibrary.org/b/id/999-L.jpg",
      pageCount: 245,
      publisher: "Bloomsbury",
      detailsFetchedAt: new Date(),
    },
  });
  // The catalog knows the year
  await prisma.catalogBook.create({ data: { key, title: "Piranesi", year: 2020 } });
  const calls = stubOpenLibrary();
  const dana = await makeUser("Dana");

  const { status, body } = await scan(dana.id, isbn);

  expect(status).toBe(200);
  expect(body).toMatchObject({
    added: { title: "Piranesi", author: "Susanna Clarke", cover: "https://covers.openlibrary.org/b/id/999-L.jpg" },
  });
  const added = await prisma.book.findFirstOrThrow({ where: { userId: dana.id } });
  expect(added).toMatchObject({
    isbn,
    openLibraryKey: key,
    pageCount: 245,
    publisher: "Bloomsbury",
    datePublished: "2020",
  });
  expect(calls).toEqual([]);
});

test("a book new to Stacks is still looked up on Open Library", async () => {
  const isbn = anIsbn();
  const key = `/works/OL${crypto.randomUUID().slice(0, 8)}W`;
  const calls = stubOpenLibrary([{ key, title: "Holes", author_name: ["Louis Sachar"], cover_i: 7 }]);
  const dana = await makeUser("Dana");

  const { body } = await scan(dana.id, isbn);

  expect(body).toMatchObject({ added: { title: "Holes", author: "Louis Sachar" } });
  expect(calls.some((url) => url.includes(`isbn%3A${isbn}`))).toBe(true);
});
