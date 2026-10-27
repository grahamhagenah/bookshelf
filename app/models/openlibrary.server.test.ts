// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import { ensureBookDetails, fillInBook } from "./openlibrary.server";

// A stand-in for Open Library: a search hit for Piranesi, a description
// for its work, an author, and an edition record with the given covers
function stubOpenLibrary(editionCovers: number[] = []) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    const reply = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
    if (url.startsWith("https://openlibrary.org/search.json")) {
      return reply({
        docs: [
          {
            key: "/works/OL123W",
            cover_i: 999,
            first_publish_year: 2020,
            number_of_pages_median: 245,
            subject: ["Fantasy", "Labyrinths"],
            // The work's list mixes in translations; the English edition's is the one kept
            publisher: ["Alberdania", "Bloomsbury"],
            editions: { docs: [{ key: "/books/OL1M", publisher: ["Bloomsbury"] }] },
            first_sentence: ["When the Moon rose in the Third Northern Hall I went to the Ninth Vestibule."],
            author_key: ["OL1A"],
            isbn: ["1635575635", "9781635575637"],
          },
        ],
      });
    }
    if (url === "https://openlibrary.org/works/OL123W.json") {
      return reply({ description: { value: "A man lives in a house of endless halls." } });
    }
    if (url.startsWith("https://openlibrary.org/authors/")) {
      return reply({ name: "Susanna Clarke" });
    }
    if (url.startsWith("https://openlibrary.org/isbn/")) {
      return reply({ covers: editionCovers });
    }
    throw new Error(`Unexpected fetch: ${url} ${init?.method ?? ""}`);
  });
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

test("fills in what an imported book is missing and keeps what it has", async () => {
  const calls = stubOpenLibrary();
  const owner = await makeUser("Olive");
  const book = await makeBook(owner.id, "Piranesi");
  // As the import leaves it: an ISBN cover that turns out blank, no
  // description, a page count the file did have
  await prisma.book.update({
    where: { id: book.id },
    data: {
      cover: "https://covers.openlibrary.org/b/isbn/9781635575637-L.jpg",
      isbn: "9781635575637",
      pageCount: 300,
      body: "",
    },
  });

  await fillInBook(book.id);

  const filled = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
  expect(filled).toMatchObject({
    cover: "https://covers.openlibrary.org/b/id/999-L.jpg",
    body: "A man lives in a house of endless halls.",
    openLibraryKey: "/works/OL123W",
    datePublished: "2020",
    pageCount: 300,
    subjects: "Fantasy, Labyrinths",
    publisher: "Bloomsbury",
    authorKey: "OL1A",
  });
  expect(filled.firstSentence).toContain("Third Northern Hall");
  expect(filled.detailsFetchedAt).not.toBeNull();
  // Looked up by ISBN, since it had one
  expect(calls[0]).toContain("isbn%3A9781635575637");
});

test("an ISBN cover is kept by its edition's cover ID", async () => {
  // A fresh ISBN: what's found for one is remembered
  const isbn = `978${String(Math.random()).slice(2, 12)}`;
  stubOpenLibrary([-1, 555]);
  const owner = await makeUser("Olive");
  const book = await makeBook(owner.id, "Piranesi");
  await prisma.book.update({
    where: { id: book.id },
    data: { cover: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`, isbn, body: "" },
  });

  await fillInBook(book.id);

  const filled = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
  // The edition's own picture, not the work's
  expect(filled.cover).toBe("https://covers.openlibrary.org/b/id/555-L.jpg");
});

test("a book Open Library doesn't know is still marked as looked up", async () => {
  vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ docs: [] }), { status: 200 }));
  const owner = await makeUser("Olive");
  const book = await makeBook(owner.id, "My Own Zine");
  await prisma.book.update({ where: { id: book.id }, data: { cover: "", body: "" } });

  await fillInBook(book.id);

  const same = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
  expect(same).toMatchObject({ cover: "", body: "", openLibraryKey: null });
  expect(same.detailsFetchedAt).not.toBeNull();
});

// A work no other test has, and a book on someone's shelf of it whose
// details were looked up
async function lookedUpCopy(details: { isbn?: string } = {}) {
  const key = `/works/OL${crypto.randomUUID().slice(0, 8)}W`;
  const theirs = await makeBook((await makeUser("Priya")).id, "Piranesi");
  await prisma.book.update({
    where: { id: theirs.id },
    data: {
      openLibraryKey: key,
      cover: "https://covers.openlibrary.org/b/id/999-L.jpg",
      body: "A man lives in a house of endless halls.",
      firstSentence: "When the Moon rose in the Third Northern Hall I went to the Ninth Vestibule.",
      authorKey: "OL1A",
      subjects: "Fantasy, Labyrinths",
      pageCount: 245,
      publisher: "Bloomsbury",
      datePublished: "2020",
      detailsFetchedAt: new Date(),
      ...details,
    },
  });
  return key;
}

// Open Library, failing the test if it's asked anything
function forbidOpenLibrary() {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: string | URL) => {
    calls.push(String(input));
    throw new Error("Open Library shouldn't be asked");
  });
  return calls;
}

test("a new copy of a work another shelf has looked up takes its details, without asking Open Library", async () => {
  const key = await lookedUpCopy();
  const calls = forbidOpenLibrary();
  const book = await makeBook((await makeUser("Olive")).id, "Piranesi");
  // Added from a search: the work and its cover known, and a page count
  // the owner gave
  await prisma.book.update({
    where: { id: book.id },
    data: { openLibraryKey: key, cover: "https://covers.openlibrary.org/b/id/42-L.jpg", pageCount: 272 },
  });

  await fillInBook(book.id);

  const filled = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
  expect(filled).toMatchObject({
    cover: "https://covers.openlibrary.org/b/id/42-L.jpg",
    body: "A man lives in a house of endless halls.",
    authorKey: "OL1A",
    subjects: "Fantasy, Labyrinths",
    pageCount: 272,
    publisher: "Bloomsbury",
    datePublished: "2020",
  });
  expect(filled.firstSentence).toContain("Third Northern Hall");
  expect(filled.detailsFetchedAt).not.toBeNull();
  expect(calls).toEqual([]);
});

test("a book whose work isn't known takes it from a looked-up copy with its ISBN", async () => {
  const isbn = `978${String(Math.random()).slice(2, 12)}`;
  const key = await lookedUpCopy({ isbn });
  const calls = forbidOpenLibrary();
  const book = await makeBook((await makeUser("Olive")).id, "Piranesi");
  await prisma.book.update({ where: { id: book.id }, data: { isbn, cover: "", body: "" } });

  await fillInBook(book.id);

  const filled = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
  expect(filled).toMatchObject({
    openLibraryKey: key,
    cover: "https://covers.openlibrary.org/b/id/999-L.jpg",
    body: "A man lives in a house of endless halls.",
  });
  expect(calls).toEqual([]);
});

test("refreshing a book asks Open Library, whatever other copies say", async () => {
  const key = await lookedUpCopy();
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
    if (url.startsWith("https://openlibrary.org/search.json")) {
      return reply({ docs: [{ key, title: "Piranesi", first_sentence: ["The newer opening line."], author_key: ["OL2A"] }] });
    }
    if (url.startsWith("https://openlibrary.org/authors/")) return reply({ name: "Susanna Clarke" });
    return reply({});
  });
  const book = await makeBook((await makeUser("Olive")).id, "Piranesi");
  await prisma.book.update({
    where: { id: book.id },
    data: { openLibraryKey: key, cover: "https://covers.openlibrary.org/b/id/42-L.jpg", detailsFetchedAt: new Date() },
  });

  await ensureBookDetails(book, { force: true });

  expect(calls.some((url) => url.startsWith("https://openlibrary.org/search.json"))).toBe(true);
  const refreshed = await prisma.book.findUniqueOrThrow({ where: { id: book.id } });
  expect(refreshed).toMatchObject({ firstSentence: "The newer opening line.", authorKey: "OL2A" });
});
