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
      },
    ];
  });

  return { source, rows };
}

// Which rows go on the shelf: just the ones marked owned, those plus
// everything read, or the whole file
export type ShelfChoice = "owned" | "read" | "all";

export function goesOnShelf(row: ImportRow, choice: ShelfChoice) {
  if (choice === "all") return true;
  if (row.owned) return true;
  return choice === "read" && (row.status === "read" || row.status === "reading");
}

// What an import would do, for the preview and the result
export function summarize(rows: ImportRow[]) {
  return {
    total: rows.length,
    owned: rows.filter((row) => row.owned).length,
    read: rows.filter((row) => goesOnShelf(row, "read")).length,
    toRead: rows.filter((row) => row.status === "to-read").length,
  };
}

// Goodreads users rarely fill in "owned copies", so only lean on it when
// they have
export function defaultChoice(rows: ImportRow[]): ShelfChoice {
  if (rows.some((row) => row.owned)) return "owned";
  if (rows.some((row) => row.status !== "unknown")) return "read";
  return "all";
}
