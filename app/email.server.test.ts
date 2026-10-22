// @vitest-environment node
import { renderBookRequest, renderVerification } from "~/email.server";

test("a borrow request names the person and book, with its cover", () => {
  const { subject, html, text } = renderBookRequest({
    toName: "Maya",
    requesterName: "Sam Okafor",
    bookTitle: "Piranesi",
    bookAuthor: "Susanna Clarke",
    bookCover: "https://covers.openlibrary.org/b/isbn/9781635575637-L.jpg",
  });
  expect(subject).toBe("Sam Okafor wants to borrow Piranesi");
  expect(html).toContain("Susanna Clarke");
  // Covers go out through the site, as full addresses
  expect(html).toContain("/covers/b/isbn/9781635575637-M.jpg");
  expect(html).toContain("See the request");
  expect(text).toContain("Piranesi by Susanna Clarke");
});

test("names and titles are escaped", () => {
  const { html } = renderBookRequest({
    toName: "Maya",
    requesterName: "<script>",
    bookTitle: "Tom & Jerry",
  });
  expect(html).not.toContain("<script>");
  expect(html).toContain("Tom &amp; Jerry");
});

test("the confirm email carries its link", () => {
  const { html } = renderVerification({ toName: "Maya", token: "a b" });
  expect(html).toContain("/verify-email?token=a%20b");
});
