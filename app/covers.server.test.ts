// @vitest-environment node
import {
  COVER_PATH,
  coverHostAllowed,
  customCoverPath,
  isbnCoverParts,
  loadCover,
} from "./covers.server";

test("COVER_PATH allows only Open Library cover paths and the app's own", () => {
  expect(COVER_PATH.test("b/isbn/9780547928227-M.jpg")).toBe(true);
  expect(COVER_PATH.test("b/id/12345-L.jpg")).toBe(true);
  expect(COVER_PATH.test("b/olid/OL123M-S.jpg")).toBe(true);

  expect(COVER_PATH.test("b/isbn/9780547928227-XL.jpg")).toBe(false);
  expect(COVER_PATH.test("a/olid/OL1A-M.jpg")).toBe(false);
  expect(COVER_PATH.test("b/isbn/../../etc/passwd-M.jpg")).toBe(false);
  expect(COVER_PATH.test("b/isbn/1-M.jpg?x=1")).toBe(false);
});

test("loadCover refuses other paths without going to the network", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  expect(await loadCover("../../secrets.txt")).toBeNull();
  // A pasted cover is only ever on disk, so an unknown one isn't fetched either
  expect(
    await loadCover("custom/0000000000000000000000000000000000000000.jpg"),
  ).toBeNull();
  expect(fetchSpy).not.toHaveBeenCalled();
  fetchSpy.mockRestore();
});

test("a pasted cover is fetched from known picture hosts only, over https", () => {
  expect(
    coverHostAllowed(
      "https://m.media-amazon.com/images/I/714-3vCeaeL._AC_UF1000,1000_QL80_.jpg",
    ),
  ).toBe(true);
  expect(
    coverHostAllowed(
      "https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/books/1.jpg",
    ),
  ).toBe(true);
  expect(coverHostAllowed("http://m.media-amazon.com/images/I/x.jpg")).toBe(
    false,
  );
  expect(coverHostAllowed("https://example.com/cover.jpg")).toBe(false);
  expect(
    coverHostAllowed("https://evil.media-amazon.com.attacker.net/x.jpg"),
  ).toBe(false);
  expect(coverHostAllowed("https://localhost/x.jpg")).toBe(false);
  expect(coverHostAllowed("not a url")).toBe(false);
});

test("a pasted cover's path is a hash of its link, and the proxy knows it", () => {
  const path = customCoverPath("https://m.media-amazon.com/images/I/a.jpg");
  expect(path).toMatch(/^custom\/[a-f0-9]{40}\.jpg$/);
  expect(COVER_PATH.test(path)).toBe(true);
  expect(COVER_PATH.test("custom/../b/id/1-L.jpg")).toBe(false);
  expect(COVER_PATH.test("b/isbn/9780547928227-M.jpg")).toBe(true);
});

test("an ISBN cover is fetched by its edition's cover ID, which isn't rate limited", async () => {
  const isbn = `978${String(Math.random()).slice(2, 12)}`;
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    if (url === `https://openlibrary.org/isbn/${isbn}.json`) {
      return new Response(JSON.stringify({ covers: [4321] }), { status: 200 });
    }
    if (url.startsWith("https://covers.openlibrary.org/b/id/4321-")) {
      return new Response(new Uint8Array(500), { status: 200 });
    }
    throw new Error(`Unexpected fetch: ${url}`);
  });

  expect((await loadCover(`b/isbn/${isbn}-M.jpg`))?.length).toBe(500);
  expect((await loadCover(`b/isbn/${isbn}-L.jpg`))?.length).toBe(500);
  // The edition is asked once; neither picture is asked for by ISBN
  expect(calls).toEqual([
    `https://openlibrary.org/isbn/${isbn}.json`,
    "https://covers.openlibrary.org/b/id/4321-M.jpg",
    "https://covers.openlibrary.org/b/id/4321-L.jpg",
  ]);
  vi.unstubAllGlobals();
});

test("an edition without a picture isn't asked for one", async () => {
  const isbn = `978${String(Math.random()).slice(2, 12)}`;
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: string | URL) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ covers: [] }), { status: 200 });
  });
  expect(await loadCover(`b/isbn/${isbn}-M.jpg`)).toBeNull();
  expect(calls).toEqual([`https://openlibrary.org/isbn/${isbn}.json`]);
  vi.unstubAllGlobals();
});

test("isbnCoverParts reads Open Library ISBN covers only", () => {
  expect(
    isbnCoverParts("https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg"),
  ).toEqual({
    isbn: "9780547928227",
    size: "L",
  });
  expect(isbnCoverParts("b/isbn/014044913X-M.jpg")).toEqual({
    isbn: "014044913X",
    size: "M",
  });
  expect(
    isbnCoverParts("https://covers.openlibrary.org/b/id/12345-L.jpg"),
  ).toBeNull();
  expect(isbnCoverParts("/covers/custom/abc.jpg")).toBeNull();
});
