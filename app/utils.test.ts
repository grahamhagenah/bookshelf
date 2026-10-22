import {
  cleanSubjects,
  coverSrc,
  editionPublisher,
  englishTitle,
  isLatin,
  readableName,
  isDemoEmail,
  looksLikeBot,
  MIN_SIGNUP_MS,
  safeRedirect,
  stripMarkdown,
  validateEmail,
} from "./utils";

test("validateEmail returns false for non-emails", () => {
  expect(validateEmail(undefined)).toBe(false);
  expect(validateEmail(null)).toBe(false);
  expect(validateEmail("")).toBe(false);
  expect(validateEmail("not-an-email")).toBe(false);
  expect(validateEmail("n@")).toBe(false);
});

test("validateEmail returns true for emails", () => {
  expect(validateEmail("kody@example.com")).toBe(true);
});

describe("safeRedirect", () => {
  test("keeps paths on this site", () => {
    expect(safeRedirect("/books")).toBe("/books");
    expect(safeRedirect("/share/abc?x=1")).toBe("/share/abc?x=1");
  });

  test("refuses anything that could leave the site", () => {
    expect(safeRedirect("https://evil.example")).toBe("/");
    expect(safeRedirect("//evil.example")).toBe("/");
    expect(safeRedirect("books")).toBe("/");
    expect(safeRedirect(null, "/books")).toBe("/books");
    expect(safeRedirect(undefined)).toBe("/");
  });
});

test("isDemoEmail spots sandbox accounts only", () => {
  expect(isDemoEmail("you.1234@demo.stacks.invalid")).toBe(true);
  expect(isDemoEmail("reader@example.com")).toBe(false);
  expect(isDemoEmail("demo.stacks.invalid@example.com")).toBe(false);
});

test("coverSrc routes Open Library covers through the cache", () => {
  expect(coverSrc("https://covers.openlibrary.org/b/isbn/9780441172719-M.jpg")).toBe(
    "/covers/b/isbn/9780441172719-M.jpg",
  );
  expect(coverSrc("https://example.com/cover.jpg")).toBe(
    "https://example.com/cover.jpg",
  );
});

describe("cleanSubjects", () => {
  test("drops catalog codes, library labels and generic genres", () => {
    expect(
      cleanSubjects([
        "Fantasy",
        "nyt:combined-print-and-e-book-fiction=2020-10-04",
        "Accessible book",
        "Protected DAISY",
        "Fiction",
        "England -- Fiction",
        "Dune (Imaginary place)",
        "Labyrinths",
      ]),
    ).toEqual(["Fantasy", "Labyrinths"]);
  });

  test("drops what belongs to translations, not the book", () => {
    // Open Library's real list for What We Talk About When We Talk About Love
    const carver = [
      "Translations from American",
      "Korean Short stories",
      "American Short stories",
      "Translations into Korean",
      "Fiction",
      "Manners and customs",
      "Short stories",
      "American fiction (fictional works by one author)",
      "Chinese language materials",
    ];
    expect(cleanSubjects(carver)).toEqual(["American Short stories", "Manners and customs", "Short stories"]);
    // The same, from the five stored on a book before this fix
    expect(
      cleanSubjects(
        "Translations from American, Korean Short stories, American Short stories, Translations into Korean, Manners and customs",
      ),
    ).toEqual(["American Short stories", "Manners and customs"]);
  });

  test("keeps the book's own language, and translation as a topic", () => {
    expect(
      cleanSubjects(["Translations into English", "Russian fiction", "Translation", "English fiction"]),
    ).toEqual(["Russian fiction", "Translation", "English fiction"]);
  });

  test("keeps genre tags as plain topics", () => {
    expect(cleanSubjects(["genre:science_fiction"])).toEqual(["Science fiction"]);
  });

  test("dedupes, capitalizes and stops at the limit", () => {
    expect(
      cleanSubjects(["science fiction", "Science-fiction", "ecology", "a", "b", "c", "d"]),
    ).toEqual(["Science fiction", "Ecology", "A", "B", "C"]);
    expect(cleanSubjects(["one", "two", "three"], 2)).toEqual(["One", "Two"]);
  });

  test("accepts a stored comma-separated string or nothing", () => {
    expect(cleanSubjects("Fantasy, Mystery., Labyrinths")).toEqual([
      "Fantasy",
      "Mystery",
      "Labyrinths",
    ]);
    expect(cleanSubjects(null)).toEqual([]);
    expect(cleanSubjects(undefined)).toEqual([]);
  });
});

describe("stripMarkdown", () => {
  test("unwraps bold, italics and links", () => {
    expect(
      stripMarkdown(
        "**From the *New York Times* bestselling author of [Jonathan Strange](https://x.y)**, a novel.",
      ),
    ).toBe("From the New York Times bestselling author of Jonathan Strange, a novel.");
  });

  test("drops reference-style link footnotes", () => {
    expect(
      stripMarkdown("A novel ([source][1]).\n\n[1]: https://example.com"),
    ).toBe("A novel.");
  });

  test("leaves arithmetic and lone asterisks alone", () => {
    expect(stripMarkdown("5 * 3 stays.")).toBe("5 * 3 stays.");
  });

  test("collapses runs of blank lines", () => {
    expect(stripMarkdown("One.\r\n\n\n\nTwo.")).toBe("One.\n\nTwo.");
  });
});

test("editionPublisher takes the English edition's, minus catalog codes", () => {
  const edition = (publisher: string) => ({ editions: { docs: [{ publisher: [publisher] }] } });
  expect(editionPublisher(edition("Collins"))).toBe("Collins");
  expect(editionPublisher(edition("#bVintage, #c2009."))).toBe("Vintage");
  expect(editionPublisher(edition("Picador, Pan Bks"))).toBe("Picador, Pan Bks");
  expect(editionPublisher({})).toBeNull();
});

test("isLatin tells the alphabet apart from other scripts", () => {
  expect(isLatin("Gabriel García Márquez")).toBe(true);
  expect(isLatin("Ngũgĩ wa Thiong'o")).toBe(true);
  expect(isLatin("村上春樹")).toBe(false);
  expect(isLatin("Харуки Мураками")).toBe(false);
});

test("readableName puts an author's name into English", () => {
  // Open Library's record for Haruki Murakami
  const murakami = {
    name: "村上春樹",
    personal_name: "Murakami, Haruki",
    alternate_names: ["春樹 村上", "HARUKI MURAKAMI", "Haruki MURAKAMI", "Murakami Haruki", "Haruki Murakami"],
  };
  expect(readableName(murakami)).toBe("Haruki Murakami");
  // Without a personal name, the first plainly written form
  expect(readableName({ ...murakami, personal_name: null })).toBe("Murakami Haruki");
  expect(readableName({ name: "Susanna Clarke", personal_name: "Clarke, Susanna" })).toBe("Susanna Clarke");
  expect(readableName({ name: "莫言" })).toBe("莫言");
});

test("englishTitle uses the English edition's title only for a translation", () => {
  const english = (title: string) => ({ title, language: ["eng"] });
  expect(englishTitle("海辺のカフカ", english("Kafka on the Shore"))).toBe("Kafka on the Shore");
  expect(englishTitle("Cien años de soledad", english("One Hundred Years of Solitude"))).toBe(
    "One Hundred Years of Solitude",
  );
  expect(englishTitle("Sapiens", english("Sapiens: A Brief History of Humankind"))).toBe("Sapiens");
  expect(
    englishTitle("What We Talk About When We Talk About Love", english("What we talk about when we talk about love")),
  ).toBe("What We Talk About When We Talk About Love");
  expect(englishTitle("海辺のカフカ", { title: "Kafka am Strand", language: ["ger"] })).toBe("海辺のカフカ");
  expect(englishTitle("Piranesi", undefined)).toBe("Piranesi");
});

test("coverSrc can ask Open Library for a smaller size", () => {
  expect(coverSrc("https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg", "M")).toBe(
    "/covers/b/isbn/9780441172719-M.jpg",
  );
  expect(coverSrc("https://example.com/cover.jpg", "M")).toBe("https://example.com/cover.jpg");
});

function signupForm(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  return formData;
}

test("looksLikeBot passes a person who took their time", () => {
  const now = 1_000_000;
  const form = signupForm({ website: "", renderedAt: String(now - MIN_SIGNUP_MS) });
  expect(looksLikeBot(form, now)).toBe(null);
});

test("looksLikeBot catches a filled honeypot", () => {
  const now = 1_000_000;
  const form = signupForm({ website: "http://spam.example", renderedAt: "1" });
  expect(looksLikeBot(form, now)).toBe("honeypot");
});

test("looksLikeBot catches forms sent too fast or without a timestamp", () => {
  const now = 1_000_000;
  expect(looksLikeBot(signupForm({ renderedAt: String(now - 500) }), now)).toBe("too-fast");
  expect(looksLikeBot(signupForm({}), now)).toBe("too-fast");
  expect(looksLikeBot(signupForm({ renderedAt: "soon" }), now)).toBe("too-fast");
});
