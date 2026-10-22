// @vitest-environment node
import {
  cleanTitle,
  defaultChoice,
  parseCsv,
  readExport,
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

  expect(summarize(rows)).toEqual({ total: 3, owned: 1, read: 2, toRead: 1 });
  expect(defaultChoice(rows)).toBe("owned");
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
  // Nothing marked owned, so lean on what's been read
  expect(defaultChoice(rows)).toBe("read");
});

test("a file without a Title column has no books in it", () => {
  expect(readExport("name,thing\nx,y\n").rows).toEqual([]);
});
