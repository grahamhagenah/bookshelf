// Temporary: the cover ID of each demo ISBN's edition, checked at both
// sizes the app uses. Run on a CI runner, which can reach Open Library.
import { readFileSync } from "node:fs";

const source = readFileSync("app/models/demo.server.ts", "utf8");
const re = /title:\s*"([^"]+)",\s*author:\s*"([^"]+)",\s*isbn:\s*"(\d+)"/g;
const books = new Map();
for (let m; (m = re.exec(source)); ) books.set(m[3], { title: m[1], isbn: m[3] });

async function attempt(fn) {
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === 2) return `ERR ${e.name}`;
      await new Promise((ok) => setTimeout(ok, 2000));
    }
  }
}
const bytes = (url) =>
  attempt(async () => {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    return res.ok ? (await res.arrayBuffer()).byteLength : `HTTP ${res.status}`;
  });

const out = [];
for (const book of books.values()) {
  const covers = await attempt(async () => {
    const res = await fetch(`https://openlibrary.org/isbn/${book.isbn}.json`, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return `HTTP ${res.status}`;
    return (await res.json()).covers ?? [];
  });
  const ids = Array.isArray(covers) ? covers.filter((id) => id > 0) : [];
  const id = ids[0] ?? null;
  const [m, l] = id ? [await bytes(`https://covers.openlibrary.org/b/id/${id}-M.jpg`), await bytes(`https://covers.openlibrary.org/b/id/${id}-L.jpg`)] : [null, null];
  out.push(`COVER|${book.isbn}|${id}|M=${m}|L=${l}|${book.title}|${Array.isArray(covers) ? "" : covers}`);
}
console.log(out.join("\n"));
