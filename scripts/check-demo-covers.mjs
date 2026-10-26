// Temporary: finds the cover ID each demo ISBN's cover redirects to, and
// checks that picture is real. Run on a CI runner, which can reach Open
// Library.
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

const out = [];
for (const book of books.values()) {
  const location = await attempt(async () => {
    const res = await fetch(`https://covers.openlibrary.org/b/isbn/${book.isbn}-L.jpg`, { redirect: "manual", signal: AbortSignal.timeout(30000) });
    return res.headers.get("location") ?? `status ${res.status}`;
  });
  const id = String(location).match(/\/b\/id\/(\d+)-L\.jpg/)?.[1] ?? null;
  const bytes = id
    ? await attempt(async () => {
        const res = await fetch(`https://covers.openlibrary.org/b/id/${id}-M.jpg`, { signal: AbortSignal.timeout(30000) });
        return res.ok ? (await res.arrayBuffer()).byteLength : `HTTP ${res.status}`;
      })
    : null;
  out.push(`COVER|${book.isbn}|${id}|${bytes}|${book.title}|${id ? "" : location}`);
}
console.log(out.join("\n"));
