// @vitest-environment node
import type { ImportRow } from "~/import-books";
import { FREE_LIMITS } from "~/plan";

import { makeBook, makeUser, prisma } from "../../test/db";

import { findImportedWorks, importBooks } from "./import.server";

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
  rating: null,
  review: null,
  ...over,
});

test("owned books go on the shelf, others read on Also read, to-read on the list, repeats are skipped", async () => {
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
    alsoRead: 1,
    wanted: 1,
    skipped: 2,
  });
  const elsewhere = await prisma.workNote.findMany({ where: { userId: me.id } });
  expect(elsewhere.map((note) => note.title)).toEqual(["Circe"]);
  expect(elsewhere[0].workKey).toMatch(/^import:title:/);
  expect(elsewhere[0].readAt).not.toBeNull();
  const shelf = await prisma.book.findMany({ where: { userId: me.id }, orderBy: { title: "asc" } });
  expect(shelf.map((book) => book.title)).toEqual(["Dune", "The Fellowship of the Ring"]);
  expect(shelf[1]).toMatchObject({
    readAt,
    isbn: "9780618346257",
    cover: "https://covers.openlibrary.org/b/isbn/9780618346257-L.jpg",
  });
  const list = await prisma.wantToRead.findMany({ where: { userId: me.id } });
  expect(list.map((item) => item.title)).toEqual(["Piranesi"]);

  // Importing again with a wider net only adds what's new; Circe moves
  // from Also read onto the shelf
  expect(await importBooks(me.id, rows, { shelf: "read", wantToRead: true })).toMatchObject({
    added: 1,
    alsoRead: 0,
    wanted: 0,
    skipped: 4,
  });
  expect(await prisma.workNote.count({ where: { userId: me.id } })).toBe(0);
  const circe = await prisma.book.findFirstOrThrow({ where: { userId: me.id, title: "Circe" } });
  // Read, but no date given: the import marks it read anyway
  expect(circe.readAt).not.toBeNull();
  expect(circe.cover).toBe("");
});

test("reviews come along as notes and five stars as hearts, dated when read", async () => {
  const me = await makeUser("Me");
  const readAt = new Date("2019-06-01T12:00:00Z");
  const result = await importBooks(
    me.id,
    [
      row({ title: "Piranesi", owned: true, status: "read", readAt, rating: 5, review: "A house of halls." }),
      row({ title: "Circe", status: "read", readAt, rating: 5, review: "Gods are petty." }),
      row({ title: "Dune", status: "read", rating: 3 }),
    ],
    { shelf: "owned", wantToRead: false },
  );

  // Two of them: a review with five stars on the shelf, and one read elsewhere
  expect(result.notes).toBe(2);
  const copy = await prisma.book.findFirstOrThrow({ where: { userId: me.id, title: "Piranesi" } });
  const note = await prisma.readerNote.findUniqueOrThrow({
    where: { bookId_userId: { bookId: copy.id, userId: me.id } },
  });
  // Dated when read, so it isn't today's news in friends' feeds
  expect(note).toMatchObject({ loved: true, body: "A house of halls.", updatedAt: readAt });

  const elsewhere = await prisma.workNote.findMany({ where: { userId: me.id }, orderBy: { title: "asc" } });
  expect(elsewhere.map((item) => [item.title, item.loved, item.body])).toEqual([
    ["Circe", true, "Gods are petty."],
    // Three stars: read, no heart
    ["Dune", false, null],
  ]);
  expect(elsewhere[0].updatedAt).toEqual(readAt);
});

test("a full free shelf keeps the books marked owned first", async () => {
  const me = await makeUser("Me");
  await prisma.book.createMany({
    data: Array.from({ length: FREE_LIMITS.books - 2 }, (_, i) => ({
      userId: me.id,
      title: `Filler ${i}`,
      author: "Someone",
      body: "",
      cover: "",
    })),
  });

  const result = await importBooks(
    me.id,
    [
      row({ title: "Read once", status: "read" }),
      row({ title: "Read twice", status: "read" }),
      row({ title: "Mine", owned: true, status: "read" }),
      row({ title: "Also mine", owned: true }),
    ],
    { shelf: "read", wantToRead: false },
  );

  expect(result).toMatchObject({ added: 2, overLimit: 2 });
  const added = await prisma.book.findMany({
    where: { userId: me.id, title: { not: { startsWith: "Filler" } } },
    orderBy: { title: "asc" },
  });
  expect(added.map((book) => book.title)).toEqual(["Also mine", "Mine"]);
});

test("books read elsewhere are found on Open Library and take their work's key", async () => {
  const me = await makeUser("Me");
  const isbn = `978${String(Math.random()).slice(2, 12)}`;
  const workKey = `/works/OL${crypto.randomUUID().slice(0, 8)}W`;
  const readAt = new Date("2018-02-02T12:00:00Z");
  await importBooks(
    me.id,
    [row({ title: "Klara and the Sun", status: "read", isbn, readAt, rating: 5 })],
    { shelf: "owned", wantToRead: false },
  );
  vi.stubGlobal("fetch", async () =>
    new Response(JSON.stringify({ docs: [{ key: workKey, title: "Klara and the Sun", cover_i: 77 }] }), {
      status: 200,
    }),
  );

  await findImportedWorks(me.id);
  vi.unstubAllGlobals();

  const note = await prisma.workNote.findFirstOrThrow({ where: { userId: me.id } });
  // Its date kept, so finding it isn't news either
  expect(note).toMatchObject({ workKey, loved: true, updatedAt: readAt });
  expect(note.cover).toBe(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`);
});
