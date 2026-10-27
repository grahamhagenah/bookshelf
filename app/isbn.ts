// A book's ISBN can be written two ways: the 13 digits on its barcode, or
// the older 10. A scanned barcode should find a book saved with either.

// Just the digits (and a final X), if it's an ISBN at all
export function cleanIsbn(text: string) {
  const isbn = text.replace(/[\s-]/g, "").toUpperCase();
  return /^(97[89]\d{10}|\d{9}[\dX])$/.test(isbn) ? isbn : null;
}

function isbn10Check(first9: string) {
  const sum = [...first9].reduce((total, digit, index) => total + Number(digit) * (10 - index), 0);
  const check = (11 - (sum % 11)) % 11;
  return check === 10 ? "X" : String(check);
}

function isbn13Check(first12: string) {
  const sum = [...first12].reduce((total, digit, index) => total + Number(digit) * (index % 2 ? 3 : 1), 0);
  return String((10 - (sum % 10)) % 10);
}

// Both ways of writing it (one, for a 979 number, which has no 10-digit
// form)
export function isbnForms(text: string): string[] {
  const isbn = cleanIsbn(text);
  if (!isbn) return [];
  if (isbn.length === 10) {
    const core = `978${isbn.slice(0, 9)}`;
    return [isbn, core + isbn13Check(core)];
  }
  if (isbn.startsWith("978")) {
    const core = isbn.slice(3, 12);
    return [isbn, core + isbn10Check(core)];
  }
  return [isbn];
}
