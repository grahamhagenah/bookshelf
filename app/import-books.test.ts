// @vitest-environment node
import {
  cleanReview,
  cleanTitle,
  goesOnWantToRead,
  parseCsv,
  readExport,
  readList,
  summarize,
} from "./import-books";

test("parseCsv handles quoted commas, doubled quotes and line breaks", () => {
  const text = 'a,b\n"one, two","say ""hi""\nthere"\r\nplain,\n';
  expect(parseCsv(text)).toEqual([
    ["a", "b"],
    ["one, two", 'say "hi"\nthere'],
    ["plain", ""],
  ]);
});

test("cleanTitle drops Goodreads' series suffix and nothing else", () => {
  expect(cleanTitle("The Fellowship of the Ring (The Lord of the Rings, #1)")).toBe(
    "The Fellowship of the Ring",
  );
  expect(cleanTitle("Piranesi")).toBe("Piranesi");
  expect(cleanTitle("Being and Time (Harper Perennial Modern Thought)")).toBe(
    "Being and Time (Harper Perennial Modern Thought)",
  );
});

const GOODREADS = `Book Id,Title,Author,Author l-f,Additional Authors,ISBN,ISBN13,My Rating,Average Rating,Publisher,Binding,Number of Pages,Year Published,Original Publication Year,Date Read,Date Added,Bookshelves,Bookshelves with positions,Exclusive Shelf,My Review,Spoiler,Private Notes,Read Count,Owned Copies
1,"The Fellowship of the Ring (The Lord of the Rings, #1)",J.R.R. Tolkien,"Tolkien, J.R.R.",,"=""0618346252""","=""9780618346257""",5,4.38,Houghton Mifflin,Paperback,398,2003,1954,2020/03/14,2020/01/02,favorites,favorites (#1),read,,,,1,1
2,Piranesi,Susanna Clarke,"Clarke, Susanna",,"=""1635575635""","=""9781635575637""",0,4.23,Bloomsbury,Hardcover,245,2020,2020,,2021/06/01,,,to-read,,,,0,0
3,Dune,Frank Herbert,"Herbert, Frank",,"=""""","=""""",4,4.25,Ace,Paperback,604,2005,1965,,2019/05/05,,,read,,,,1,0
`;

test("reads a Goodreads export", () => {
  const { source, rows } = readExport(GOODREADS);
  expect(source).toBe("goodreads");
  expect(rows).toHaveLength(3);
  expect(rows[0]).toMatchObject({
    title: "The Fellowship of the Ring",
    author: "J.R.R. Tolkien",
    isbn: "9780618346257",
    owned: true,
    status: "read",
    pageCount: 398,
    year: "2003",
    publisher: "Houghton Mifflin",
  });
  expect(rows[0].readAt?.toISOString()).toBe("2020-03-14T12:00:00.000Z");
  expect(rows[1]).toMatchObject({ title: "Piranesi", owned: false, status: "to-read", readAt: null });
  expect(rows[2]).toMatchObject({ isbn: null, owned: false, status: "read" });

  // Dune was read but not owned: the Also read list's
  expect(summarize(rows)).toEqual({ total: 3, owned: 1, read: 2, toRead: 1, alsoRead: 1, noted: 1 });
  expect(summarize(rows, "read").alsoRead).toBe(0);
});

const STORYGRAPH = `Title,Authors,Contributors,ISBN/UID,Format,Read Status,Date Added,Last Date Read,Dates Read,Read Count,Moods,Pace,Character- or Plot-Driven?,Strong Character Development?,Loveable Characters?,Diverse Characters?,Flawed Characters?,Star Rating,Review,Content Warnings,Content Warning Description,Tags,Owned?
Circe,"Madeline Miller, Someone Else",,9780316556347,hardcover,read,2022/01/10,2022/02/01,2022/01/15-2022/02/01,1,adventurous,medium,,,,,,4.5,,,,,
The Overstory,Richard Powers,,9780393635522,paperback,to-read,2023/04/02,,,0,,,,,,,,,,,,,
`;

test("reads a StoryGraph export", () => {
  const { source, rows } = readExport(STORYGRAPH);
  expect(source).toBe("storygraph");
  expect(rows[0]).toMatchObject({
    title: "Circe",
    author: "Madeline Miller",
    isbn: "9780316556347",
    owned: false,
    status: "read",
  });
  expect(rows[0].readAt?.toISOString()).toBe("2022-02-01T12:00:00.000Z");
  expect(rows[1]).toMatchObject({ status: "to-read", owned: false });
  // Nothing marked owned: what's been read goes on the Also read list
  expect(summarize(rows).alsoRead).toBe(1);
  // Four and a half stars is no heart
  expect(rows[0]).toMatchObject({ rating: 4.5, review: null });
});

test("reviews and stars come along; Goodreads' line breaks and markup are tidied", () => {
  const header = "Title,Author,My Rating,My Review,Exclusive Shelf,Owned Copies";
  const { rows } = readExport(
    `${header}\nCirce,Madeline Miller,5,"Gods are petty.<br/><br/>Witches are <i>not</i> &amp; never were.",read,0\nDune,Frank Herbert,0,,read,0\n`,
  );
  expect(rows[0]).toMatchObject({ rating: 5, review: "Gods are petty.\n\nWitches are not & never were." });
  expect(rows[1]).toMatchObject({ rating: null, review: null });
  expect(cleanReview("  ")).toBeNull();
});

test("a spreadsheet of one's own books is all theirs", () => {
  const { source, rows } = readExport("Title,Author,ISBN\nPiranesi,Susanna Clarke,9781635575637\n");
  expect(source).toBe("generic");
  expect(rows[0]).toMatchObject({ owned: true, isbn: "9781635575637" });
  // So it all goes on the shelf
  expect(summarize(rows)).toMatchObject({ total: 1, owned: 1, alsoRead: 0 });
});

test("a spreadsheet's other columns are named, since they don't come along", () => {
  const { leftOut } = readExport("Title,Author,ISBN,Shelf location,Notes\nPiranesi,Susanna Clarke,,Den 1,\n");
  expect(leftOut).toEqual(["Shelf location", "Notes"]);
  // An app's export says nothing of the sort
  expect(readExport("Title,Author,Exclusive Shelf,Shelf location\nPiranesi,Susanna Clarke,read,Den\n").leftOut).toEqual([]);
});

test("a book being read and not owned goes on the want-to-read list, not nowhere", () => {
  const { rows } = readExport(
    "Title,Author,Exclusive Shelf,Owned Copies\nTrust,Hernan Diaz,currently-reading,0\nPiranesi,Susanna Clarke,currently-reading,1\n",
  );
  expect(rows.map((item) => goesOnWantToRead(item, "owned"))).toEqual([true, false]);
  expect(summarize(rows)).toMatchObject({ owned: 1, toRead: 1 });
});

test("a file without a Title column has no books in it", () => {
  expect(readExport("name,thing\nx,y\n").rows).toEqual([]);
});

test("reads a LibraryThing export: authors put first-name first, ISBNs out of their lists", () => {
  const { source, rows } = readExport(
    `Book Id,Title,Sort Character,Primary Author,Primary Author Role,ISBNs,Rating,Review,Collections,Date Read,Entry Date,Page Count\n` +
      `1,Piranesi,1,"Clarke, Susanna",Author,"[1635575635, 9781635575637]",5,"Halls and tides.","Your library",2021-03-01,2020-12-25,272\n` +
      `2,Circe,1,"Miller, Madeline",Author,"[9780316556347]",4,,"Read but unowned",2019-07-04,2019-06-01,393\n` +
      `3,Dune,1,"Herbert, Frank",Author,,,,"Wishlist",,2024-01-01,\n`,
  );
  expect(source).toBe("librarything");
  expect(rows[0]).toMatchObject({
    title: "Piranesi",
    author: "Susanna Clarke",
    isbn: "9781635575637",
    owned: true,
    status: "read",
    rating: 5,
    review: "Halls and tides.",
    pageCount: 272,
  });
  expect(rows[1]).toMatchObject({ author: "Madeline Miller", owned: false, status: "read" });
  expect(rows[2]).toMatchObject({ owned: false, status: "to-read" });
});

test("reads a Libib export: all owned, read once completed", () => {
  const { source, rows } = readExport(
    `item_type,title,creators,first_name,last_name,ean_isbn13,upc_isbn10,description,publisher,publish_date,group,tags,notes,price,length,rating,review,review_date,status,began,completed,added,copies\n` +
      `book,Lonesome Dove,Larry McMurtry,Larry,McMurtry,9781439195260,,,Simon & Schuster,2010-04-01,,,,,858,5,Gus forever.,,Completed,,2022-08-01,2022-07-01,1\n` +
      `book,Blood Meridian,Cormac McCarthy,Cormac,McCarthy,9780679728757,,,Vintage,1992,,,,,351,,,,Not begun,,,2023-01-01,1\n`,
  );
  expect(source).toBe("libib");
  expect(rows[0]).toMatchObject({
    title: "Lonesome Dove",
    author: "Larry McMurtry",
    isbn: "9781439195260",
    owned: true,
    status: "read",
    year: "2010",
    publisher: "Simon & Schuster",
    pageCount: 858,
    rating: 5,
    review: "Gus forever.",
  });
  expect(rows[0].readAt?.toISOString()).toBe("2022-08-01T12:00:00.000Z");
  expect(rows[1]).toMatchObject({ owned: true, status: "unknown", readAt: null });
});

test("a pasted list: titles, titles with authors, and ISBNs", () => {
  const rows = readList(
    [
      "Piranesi by Susanna Clarke",
      "The Remains of the Day — Kazuo Ishiguro",
      "Blood Meridian - Cormac McCarthy",
      "Lonesome Dove\tLarry McMurtry",
      "Stand by Me",
      "978-0-441-17271-9",
      "",
      "   ",
      "Middlemarch",
    ].join("\n"),
  );
  expect(rows.map((row) => [row.title, row.author, row.isbn])).toEqual([
    ["Piranesi", "Susanna Clarke", null],
    ["The Remains of the Day", "Kazuo Ishiguro", null],
    ["Blood Meridian", "Cormac McCarthy", null],
    ["Lonesome Dove", "Larry McMurtry", null],
    // "by" splits on the last one, so a title with "by" in it and no
    // author is read as best it can be
    ["Stand", "Me", null],
    ["", "", "9780441172719"],
    ["Middlemarch", "", null],
  ]);
  expect(rows.every((row) => row.owned)).toBe(true);
});
