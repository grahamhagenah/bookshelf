import { pageUrl } from "./page-url";

const at = (url: string) => pageUrl(new Request(url)).toString();

test("a page's own address is left alone", () => {
  expect(at("https://x.test/books/1?shown=30")).toBe("https://x.test/books/1?shown=30");
});

test("data requests are taken back to the page they're for", () => {
  expect(at("https://x.test/feed.data")).toBe("https://x.test/feed");
  expect(at("https://x.test/_root.data")).toBe("https://x.test/");
  expect(at("https://x.test/_.data")).toBe("https://x.test/");
  expect(at("https://x.test/groups/a/_.data")).toBe("https://x.test/groups/a/");
  expect(at("https://x.test/search.data?q=dune&_routes=root,routes/search")).toBe("https://x.test/search?q=dune");
  expect(at("https://x.test/books.data?index")).toBe("https://x.test/books");
});
