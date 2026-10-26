// Temporary: checks every demo book's Open Library cover, by ISBN and by
// the work's own cover, and prints a table. Run on a CI runner, which can
// reach Open Library.
import { readFileSync } from "node:fs";

const source = readFileSync("app/models/demo.server.ts", "utf8");
const re = /title:\s*"([^"]+)",\s*author:\s*"([^"]+)",\s*isbn:\s*"(\d+)"/g;
const books = new Map();
for (let m; (m = re.exec(source)); ) books.set(m[3], { title: m[1], author: m[2], isbn: m[3] });

async function size(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) return `HTTP ${res.status}`;
      return (await res.arrayBuffer()).byteLength;
    } catch (e) {
      if (attempt === 2) return `ERR ${e.name}`;
    }
  }
}

async function search(book) {
  const q = `title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.author)}`;
  try {
    const res = await fetch(`https://openlibrary.org/search.json?${q}&limit=3&fields=key,title,author_name,cover_i,editions,editions.isbn,editions.cover_i&lang=en`, { signal: AbortSignal.timeout(30000) });
    const data = await res.json();
    return data.docs?.[0] ?? null;
  } catch (e) {
    return { error: e.name };
  }
}

const rows = [];
const queue = [...books.values()];
await Promise.all(Array.from({ length: 4 }, async () => {
  for (let book = queue.shift(); book; book = queue.shift()) {
    const isbnBytes = await size(`https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg`);
    const doc = await search(book);
    const coverId = doc?.cover_i ?? null;
    const idBytes = coverId ? await size(`https://covers.openlibrary.org/b/id/${coverId}-L.jpg`) : null;
    rows.push({ ...book, isbnBytes, coverId, idBytes, workTitle: doc?.title, workAuthor: doc?.author_name?.[0], error: doc?.error });
  }
}));
rows.sort((a, b) => a.title.localeCompare(b.title));
for (const r of rows) {
  const isbnOk = typeof r.isbnBytes === "number" && r.isbnBytes > 1000;
  const idOk = typeof r.idBytes === "number" && r.idBytes > 1000;
  console.log(
    `RESULT|${isbnOk ? "ISBN_OK" : idOk ? "WORK_OK" : "NONE"}|${r.isbn}|${r.title}|${r.author}|isbnBytes=${r.isbnBytes}|cover_i=${r.coverId}|idBytes=${r.idBytes}|match=${r.workTitle} / ${r.workAuthor}${r.error ? `|error=${r.error}` : ""}`,
  );
}
