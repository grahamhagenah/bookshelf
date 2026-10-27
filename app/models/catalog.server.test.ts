// @vitest-environment node
import { makeBook, makeUser, prisma } from "../../test/db";

import {
  catalogCandidates,
  fromSearchResult,
  onShelves,
  rememberBooks,
} from "./catalog.server";

// A work key of its own for each test
const aKey = () => `/works/OL${crypto.randomUUID().replace(/-/g, "")}W`;

const entry = (key: string, title: string, details: Partial<Parameters<typeof rememberBooks>[0][number]> = {}) => ({
  key,
  title,
  author: "Susanna Clarke",
  coverId: null,
  year: null,
  pages: null,
  subjects: null,
  publisher: null,
  editions: null,
  ...details,
});

test("remembers books, and a detail left out later doesn't wipe one given", async () => {
  const key = aKey();
  await rememberBooks([entry(key, "Piranesi", { publisher: "Bloomsbury", coverId: 10 })]);
  // A quick search has no publisher, but a newer cover
  await rememberBooks([entry(key, "Piranesi", { coverId: 11 })]);

  expect(await prisma.catalogBook.findUnique({ where: { key } })).toMatchObject({
    title: "Piranesi",
    publisher: "Bloomsbury",
    coverId: 11,
  });
});

test("only Open Library works are kept", async () => {
  await rememberBooks([entry("/books/OL1M", "An edition"), entry("", "No key")]);
  expect(await prisma.catalogBook.count({ where: { key: { in: ["/books/OL1M", ""] } } })).toBe(0);
});

test("finds books by any case of the words in their title or author", async () => {
  const key = aKey();
  const marker = `zq${crypto.randomUUID().slice(0, 6)}`;
  await rememberBooks([entry(key, `The ${marker} Halls`, { author: "Susanna Clarke" })]);

  const keys = async (typed: string[]) => (await catalogCandidates(typed)).map((book) => book.key);
  expect(await keys([marker.toUpperCase(), "clarke"])).toContain(key);
  expect(await keys([marker, "tolkien"])).not.toContain(key);
});

test("tells which works someone here has a copy of", async () => {
  const owner = await makeUser("Olive");
  const book = await makeBook(owner.id, "Piranesi");
  const shelved = aKey();
  await prisma.book.update({ where: { id: book.id }, data: { openLibraryKey: shelved } });

  expect([...(await onShelves([shelved, aKey()]))]).toEqual([shelved]);
});

test("a search result becomes an entry; one without a work key doesn't", () => {
  expect(
    fromSearchResult({
      key: "/works/OL1W",
      title: "Piranesi",
      author_name: ["Susanna Clarke"],
      cover_i: 10,
      first_publish_year: 2020,
      number_of_pages_median: 245,
      subject: ["Fantasy"],
    }),
  ).toMatchObject({ key: "/works/OL1W", author: "Susanna Clarke", coverId: 10, year: 2020, pages: 245, subjects: "Fantasy" });
  expect(fromSearchResult({ title: "Piranesi" })).toBeNull();
});
