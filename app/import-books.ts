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

export type ImportSource = "goodreads" | "storygraph" | "generic";

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

export function readExport(text: string): {
  source: ImportSource;
  rows: ImportRow[];
} {
  const [header = [], ...lines] = parseCsv(text);
  const columns = header.map((name) => name.trim().toLowerCase());
  const column = (name: string) => columns.indexOf(name.toLowerCase());
  const titleAt = column("title");
  if (titleAt === -1) return { source: "generic", rows: [] };

  const source: ImportSource =
    column("exclusive shelf") !== -1
      ? "goodreads"
      : column("read status") !== -1
        ? "storygraph"
        : "generic";

  const get = (cells: string[], name: string) => {
    const at = column(name);
    return at === -1 ? undefined : cells[at];
  };

  const rows = lines.flatMap((cells): ImportRow[] => {
    const title = cleanTitle(cells[titleAt] ?? "");
    if (!title) return [];
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

  return { source, rows };
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

// What an import would do, for the preview and the result
export function summarize(rows: ImportRow[], choice: ShelfChoice = "owned") {
  return {
    total: rows.length,
    owned: rows.filter((row) => row.owned).length,
    read: rows.filter((row) => goesOnShelf(row, "read")).length,
    toRead: rows.filter((row) => row.status === "to-read").length,
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
