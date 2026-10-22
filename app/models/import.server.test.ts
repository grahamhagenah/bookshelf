// @vitest-environment node
import type { ImportRow } from "~/import-books";

import { makeBook, makeUser, prisma } from "../../test/db";

import { importBooks } from "./import.server";

const row = (over: Partial<ImportRow> & { title: string }): ImportRow => ({
  author: "Someone",
  isbn: null,
  owned: false,
  status: "unknown",
  readAt: null,
  addedAt: null,
  pageCount: null,
  year: null,
  publisher: null,
  ...over,
});

test("owned books go on the shelf, to-read books on the list, repeats are skipped", async () => {
  const me = await makeUser("Me");
  await makeBook(me.id, "Dune");
  const readAt = new Date("2020-03-14T12:00:00Z");
  const rows = [
    row({ title: "The Fellowship of the Ring", owned: true, status: "read", readAt, isbn: "9780618346257" }),
    row({ title: "Piranesi", status: "to-read", isbn: "9781635575637" }),
    row({ title: "Dune", status: "read" }),
    row({ title: "Circe", status: "read" }),
    // Twice in the file
    row({ title: "Circe", status: "read" }),
  ];

  expect(await importBooks(me.id, rows, { shelf: "owned", wantToRead: true })).toMatchObject({
    added: 1,
    wanted: 1,
    skipped: 2,
  });
  const shelf = await prisma.book.findMany({ where: { userId: me.id }, orderBy: { title: "asc" } });
  expect(shelf.map((book) => book.title)).toEqual(["Dune", "The Fellowship of the Ring"]);
  expect(shelf[1]).toMatchObject({
    readAt,
    isbn: "9780618346257",
    cover: "https://covers.openlibrary.org/b/isbn/9780618346257-L.jpg",
  });
  const list = await prisma.wantToRead.findMany({ where: { userId: me.id } });
  expect(list.map((item) => item.title)).toEqual(["Piranesi"]);

  // Importing again with a wider net only adds what's new
  expect(await importBooks(me.id, rows, { shelf: "read", wantToRead: true })).toMatchObject({
    added: 1,
    wanted: 0,
    skipped: 4,
  });
  const circe = await prisma.book.findFirstOrThrow({ where: { userId: me.id, title: "Circe" } });
  // Read, but no date given: the import marks it read anyway
  expect(circe.readAt).not.toBeNull();
  expect(circe.cover).toBe("");
});
