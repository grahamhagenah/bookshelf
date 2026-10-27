// Reading a Goodreads or StoryGraph export. Pure functions, so the import
// page can preview a file in the browser and the server can read it the
// same way.

export type ReadStatus = "read" | "reading" | "to-read" | "unknown";

export interface ImportRow {
  title: string;
  author: string;
  isbn: string | null;
  owned: boolean;
  status: ReadStatus;
  // When they finished it, if the export says
  readAt: Date | null;
  addedAt: Date | null;
  pageCount: number | null;
  year: string | null;
  publisher: string | null;
  // Their stars (out of 5) and review there; five stars become a heart
  // and the review their note
  rating: number | null;
  review: string | null;
}

export type ImportSource =
  | "goodreads"
  | "storygraph"
  | "librarything"
  | "libib"
  | "generic"
  // Typed or pasted in, one book a line
  | "list";

// RFC 4180, with quoted fields, doubled quotes and newlines inside quotes
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const body = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (quoted) {
      if (char === '"') {
        if (body[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && body[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

// Goodreads writes ISBNs as ="9780441172719" to keep spreadsheets from
// mangling them
function cleanIsbn(value: string | undefined) {
  const digits = (value ?? "").replace(/[^0-9Xx]/g, "");
  return digits.length === 10 || digits.length === 13 ? digits : null;
}

// Dates come as 2023/05/14 (both sites); anything unreadable is dropped
function parseDate(value: string | undefined) {
  if (!value) return null;
  const match = value.trim().match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (!match) return null;
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3], 12));
  return Number.isNaN(date.getTime()) ? null : date;
}

// A star rating; Goodreads writes 0 for none, StoryGraph leaves it empty
// and allows halves
function parseRating(value: string | undefined) {
  const n = parseFloat(value ?? "");
  return Number.isFinite(n) && n > 0 && n <= 5 ? n : null;
}

// A review as plain text: Goodreads keeps the line breaks as <br/> and
// may carry a little other markup
export function cleanReview(value: string | undefined) {
  const text = (value ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(p|div)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return text || null;
}

// The first ISBN in a cell that may hold several ("[1635575635,
// 9781635575637]", as LibraryThing writes them), a 13-digit one first
function firstIsbn(value: string | undefined) {
  const found = (value ?? "").match(/[0-9Xx-]{10,17}/g) ?? [];
  const isbns = found.map((one) => cleanIsbn(one)).filter((one) => one !== null);
  return isbns.find((one) => one.length === 13) ?? isbns[0] ?? null;
}

// "Clarke, Susanna" (how LibraryThing lists authors) as it's printed
function firstNameFirst(name: string) {
  const [last, first] = name.split(",").map((part) => part.trim());
  return first ? `${first} ${last}` : name.trim();
}

function parseCount(value: string | undefined) {
  const n = parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// "The Fellowship of the Ring (The Lord of the Rings, #1)" -> the title
export function cleanTitle(title: string) {
  return title.replace(/\s*\([^()]*#\d+[^()]*\)\s*$/, "").trim();
}

function statusFromShelf(shelf: string | undefined): ReadStatus {
  switch ((shelf ?? "").trim().toLowerCase()) {
    case "read":
      return "read";
    case "currently-reading":
      return "reading";
    case "to-read":
      return "to-read";
    default:
      return "unknown";
  }
}

const yes = (value: string | undefined) =>
  /^(yes|true|y|1)$/i.test((value ?? "").trim());

// What a spreadsheet of one's own can carry over
const GENERIC_COLUMNS = ["title", "author", "authors", "isbn", "isbn13"];

export function readExport(text: string): {
  source: ImportSource;
  rows: ImportRow[];
  // A spreadsheet's columns that don't come along, to say so
  leftOut: string[];
} {
  const [header = [], ...lines] = parseCsv(text);
  const columns = header.map((name) => name.trim().toLowerCase());
  const column = (name: string) => columns.indexOf(name.toLowerCase());
  const titleAt = column("title");
  if (titleAt === -1) return { source: "generic", rows: [], leftOut: [] };

  const source: ImportSource =
    column("exclusive shelf") !== -1
      ? "goodreads"
      : column("read status") !== -1
        ? "storygraph"
        : column("primary author") !== -1
          ? "librarything"
          : column("ean_isbn13") !== -1
            ? "libib"
            : "generic";

  const get = (cells: string[], name: string) => {
    const at = column(name);
    return at === -1 ? undefined : cells[at];
  };

  const rows = lines.flatMap((cells): ImportRow[] => {
    const title = cleanTitle(cells[titleAt] ?? "");
    if (!title) return [];

    if (source === "librarything") {
      // Its collections say what's owned, read or wanted
      const collections = (get(cells, "collections") ?? "").toLowerCase();
      const wanted = /wishlist|to read/.test(collections);
      const readElsewhere = collections.includes("read but unowned");
      const readAt = parseDate(get(cells, "date read"));
      const status: ReadStatus = wanted
        ? "to-read"
        : readElsewhere || readAt
          ? "read"
          : collections.includes("currently reading")
            ? "reading"
            : "unknown";
      return [
        {
          title,
          author: firstNameFirst(get(cells, "primary author") ?? ""),
          isbn: firstIsbn(get(cells, "isbns")) ?? firstIsbn(get(cells, "isbn")),
          owned: !wanted && !readElsewhere,
          status,
          readAt,
          addedAt: parseDate(get(cells, "entry date")),
          pageCount: parseCount(get(cells, "page count")),
          year: get(cells, "publication")?.match(/\b\d{4}\b/)?.[0] ?? null,
          publisher: null,
          rating: parseRating(get(cells, "rating")),
          review: cleanReview(get(cells, "review")),
        },
      ];
    }
    if (source === "libib") {
      // Everything in a Libib library is a book someone has; its status
      // says whether they've read it
      const libibStatus = (get(cells, "status") ?? "").toLowerCase();
      const status: ReadStatus = libibStatus.includes("complete")
        ? "read"
        : libibStatus.includes("progress")
          ? "reading"
          : "unknown";
      return [
        {
          title,
          author: (get(cells, "creators") ?? "").split(",")[0].trim(),
          isbn: cleanIsbn(get(cells, "ean_isbn13")) ?? cleanIsbn(get(cells, "upc_isbn10")),
          owned: true,
          status,
          readAt: status === "read" ? parseDate(get(cells, "completed")) : null,
          addedAt: parseDate(get(cells, "added")),
          pageCount: parseCount(get(cells, "length")),
          year: get(cells, "publish_date")?.match(/\b\d{4}\b/)?.[0] ?? null,
          publisher: get(cells, "publisher")?.trim() || null,
          rating: parseRating(get(cells, "rating")),
          review: cleanReview(get(cells, "review")),
        },
      ];
    }
    // StoryGraph lists every author; the first is the one on the cover
    const author = (get(cells, "author") ?? get(cells, "authors") ?? "")
      .split(",")[0]
      .trim();

    if (source === "goodreads") {
      const status = statusFromShelf(get(cells, "exclusive shelf"));
      return [
        {
          title,
          author,
          isbn: cleanIsbn(get(cells, "isbn13")) ?? cleanIsbn(get(cells, "isbn")),
          owned: (parseCount(get(cells, "owned copies")) ?? 0) > 0,
          status,
          readAt: status === "read" ? parseDate(get(cells, "date read")) : null,
          addedAt: parseDate(get(cells, "date added")),
          pageCount: parseCount(get(cells, "number of pages")),
          year: get(cells, "year published")?.trim() || null,
          publisher: get(cells, "publisher")?.trim() || null,
          rating: parseRating(get(cells, "my rating")),
          review: cleanReview(get(cells, "my review")),
        },
      ];
    }
    if (source === "storygraph") {
      const status = statusFromShelf(get(cells, "read status"));
      return [
        {
          title,
          author,
          isbn: cleanIsbn(get(cells, "isbn/uid")),
          owned: yes(get(cells, "owned?")),
          status,
          readAt: status === "read" ? parseDate(get(cells, "last date read")) : null,
          addedAt: parseDate(get(cells, "date added")),
          pageCount: null,
          year: null,
          publisher: null,
          rating: parseRating(get(cells, "star rating")),
          review: cleanReview(get(cells, "review")),
        },
      ];
    }
    return [
      {
        title,
        author,
        isbn: cleanIsbn(get(cells, "isbn13")) ?? cleanIsbn(get(cells, "isbn")),
        owned: true,
        status: "unknown",
        readAt: null,
        addedAt: null,
        pageCount: null,
        year: null,
        publisher: null,
        rating: null,
        review: null,
      },
    ];
  });

  const leftOut =
    source === "generic"
      ? header.map((name) => name.trim()).filter((name) => name && !GENERIC_COLUMNS.includes(name.toLowerCase()))
      : [];
  return { source, rows, leftOut };
}

// Which rows go on the shelf: just the ones marked owned, those plus
// everything read (for people who own what they read), or the whole file
export type ShelfChoice = "owned" | "read" | "all";

export function goesOnShelf(row: ImportRow, choice: ShelfChoice) {
  if (choice === "all") return true;
  if (row.owned) return true;
  return choice === "read" && (row.status === "read" || row.status === "reading");
}

// A book they've read that isn't going on the shelf: it goes on their
// Also read list instead, so it's kept without anyone asking to borrow it
export function goesOnAlsoRead(row: ImportRow, choice: ShelfChoice) {
  return row.status === "read" && !goesOnShelf(row, choice);
}

// A book they mean to read, or are reading and don't own: it goes on
// their want-to-read list, so it isn't lost
export function goesOnWantToRead(row: ImportRow, choice: ShelfChoice) {
  return (row.status === "to-read" || row.status === "reading") && !goesOnShelf(row, choice);
}

// What an import would do, for the preview and the result
export function summarize(rows: ImportRow[], choice: ShelfChoice = "owned") {
  return {
    total: rows.length,
    owned: rows.filter((row) => row.owned).length,
    read: rows.filter((row) => goesOnShelf(row, "read")).length,
    toRead: rows.filter((row) => goesOnWantToRead(row, choice)).length,
    alsoRead: rows.filter((row) => goesOnAlsoRead(row, choice)).length,
    // With a review or five stars, which come along
    noted: rows.filter((row) => row.review !== null || (row.rating ?? 0) >= 5)
      .length,
  };
}

// Only what's marked owned goes on the shelf unless they say otherwise: a
// shelf is what friends can borrow, and the rest they've read has the Also
// read list. A spreadsheet of their own books counts as all owned.
export const DEFAULT_CHOICE: ShelfChoice = "owned";

// A pasted list, one book a line: a title, a title and its author
// ("Piranesi by Susanna Clarke", "Piranesi - Susanna Clarke", or with a
// tab between), or just an ISBN, which is looked up for its title. All of
// them are the person's own.
export const LIST_MAX = 500;

const ISBN_LINE = /^[0-9Xx][0-9Xx\s-]{8,16}$/;

export function readList(text: string): ImportRow[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, LIST_MAX)
    .flatMap((line): ImportRow[] => {
      const row = {
        owned: true,
        status: "unknown" as const,
        readAt: null,
        addedAt: null,
        pageCount: null,
        year: null,
        publisher: null,
        rating: null,
        review: null,
      };
      if (ISBN_LINE.test(line)) {
        const isbn = cleanIsbn(line);
        return isbn ? [{ ...row, title: "", author: "", isbn }] : [];
      }
      const parts =
        line.split("\t").length > 1
          ? line.split("\t")
          : (line.match(/^(.*\S)\s+(?:by|—|–|-)\s+(\S.*)$/i)?.slice(1) ?? [line]);
      const title = cleanTitle(parts[0]?.trim() ?? "");
      if (!title) return [];
      return [{ ...row, title, author: parts[1]?.trim() ?? "", isbn: null }];
    });
}
