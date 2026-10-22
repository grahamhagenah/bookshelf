// Telling whether two records are the same book, without a database

// "The Fellowship of the Ring (The Lord of the Rings, #1)" and "the
// fellowship of the ring" are the same book
export function normalizeTitle(title: string) {
  return title
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface Work {
  title: string;
  openLibraryKey?: string | null;
  isbn?: string | null;
}

// Two records describe the same book when they share a work key or ISBN,
// or failing those, a title. Different ISBNs prove nothing: every edition
// has its own, so a paperback and a hardback still go by title.
export function sameWork(a: Work, b: Work) {
  if (a.openLibraryKey && b.openLibraryKey) {
    return a.openLibraryKey === b.openLibraryKey;
  }
  if (a.isbn && b.isbn && a.isbn === b.isbn) return true;
  return normalizeTitle(a.title) === normalizeTitle(b.title);
}
