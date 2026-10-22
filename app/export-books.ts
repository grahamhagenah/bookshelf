// Writing a shelf out as a CSV with Goodreads' column names, so the file
// can go back into Goodreads, StoryGraph or Stacks' own import. Pure, so
// it can be tested without a database.

// One copy as its reader sees it: their own read date, heart and note
export interface ExportBook {
  title: string;
  author: string;
  isbn: string | null;
  publisher: string | null;
  pageCount: number | null;
  datePublished: string | null;
  createdAt: Date;
  readAt: Date | null;
  loved: boolean;
  note: string | null;
}

const COLUMNS = [
  "Title",
  "Author",
  "ISBN",
  "ISBN13",
  "Publisher",
  "Number of Pages",
  "Year Published",
  "Date Read",
  "Date Added",
  "Bookshelves",
  "Exclusive Shelf",
  "My Review",
  "Owned Copies",
];

function cell(value: string | number | null | undefined) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Goodreads' own 2023/05/14
function day(date: Date | null) {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}/${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}`;
}

export function booksToCsv(books: ExportBook[]) {
  const lines = books.map((book) => {
    const isbn = (book.isbn ?? "").replace(/[^0-9Xx]/g, "");
    return [
      book.title,
      book.author,
      isbn.length === 10 ? isbn : "",
      isbn.length === 13 ? isbn : "",
      book.publisher,
      book.pageCount,
      book.datePublished?.match(/\d{4}/)?.[0] ?? "",
      day(book.readAt),
      day(book.createdAt),
      book.loved ? "favorites" : "",
      book.readAt ? "read" : "to-read",
      book.note,
      1,
    ]
      .map(cell)
      .join(",");
  });
  // A byte order mark so Excel reads accented titles correctly
  return "﻿" + [COLUMNS.join(","), ...lines].join("\r\n") + "\r\n";
}
