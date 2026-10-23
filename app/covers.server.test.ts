// @vitest-environment node
import {
  COVER_PATH,
  coverHostAllowed,
  customCoverPath,
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
