import { booksToCsv } from "./export-books";
import { parseCsv, readExport } from "./import-books";

const dune = {
  title: "Dune",
  author: "Frank Herbert",
  isbn: "9780441172719",
  publisher: "Ace",
  pageCount: 612,
  datePublished: "August 1990",
  createdAt: new Date(Date.UTC(2024, 0, 5, 12)),
  readAt: new Date(Date.UTC(2024, 4, 14, 12)),
  loved: true,
  note: 'Spice, "sand", and\nsandworms',
};

const unread = {
  title: "Piranesi, Book One",
  author: "Susanna Clarke",
  isbn: "1635575990",
  publisher: null,
  pageCount: null,
  datePublished: null,
  createdAt: new Date(Date.UTC(2024, 1, 1, 12)),
  readAt: null,
  loved: false,
  note: null,
};

test("booksToCsv writes Goodreads columns, quoting where it must", () => {
  const [header, first, second] = parseCsv(booksToCsv([dune, unread]));
  expect(header.slice(0, 4)).toEqual(["Title", "Author", "ISBN", "ISBN13"]);
  const row = Object.fromEntries(header.map((name, i) => [name, first[i]]));
  expect(row).toMatchObject({
    ISBN: "",
    ISBN13: "9780441172719",
    "Year Published": "1990",
    "Date Read": "2024/05/14",
    "Date Added": "2024/01/05",
    Bookshelves: "favorites",
    "Exclusive Shelf": "read",
    "My Review": 'Spice, "sand", and\nsandworms',
  });
  expect(second[0]).toBe("Piranesi, Book One");
  expect(second[2]).toBe("1635575990");
});

test("an export reads back through the importer", () => {
  const { source, rows } = readExport(booksToCsv([dune, unread]));
  expect(source).toBe("goodreads");
  expect(rows).toHaveLength(2);
  expect(rows[0]).toMatchObject({
    title: "Dune",
    author: "Frank Herbert",
    isbn: "9780441172719",
    owned: true,
    status: "read",
    readAt: dune.readAt,
    addedAt: dune.createdAt,
    pageCount: 612,
    year: "1990",
    publisher: "Ace",
  });
  expect(rows[1]).toMatchObject({ isbn: "1635575990", owned: true, status: "to-read", readAt: null });
});

test("an empty shelf is just the header", () => {
  expect(parseCsv(booksToCsv([]))).toHaveLength(1);
});
