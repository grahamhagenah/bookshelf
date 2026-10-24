// @vitest-environment node
import { renderAnnouncement, renderBookRequest, renderVerification } from "~/email.server";

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

test("an announcement carries the message, escaped, with its opt-out", () => {
  const { subject, html, text } = renderAnnouncement({
    toUserId: "u1",
    toName: "Maya",
    message: "Big updates: a public page for your shelf.\nQuestions & notes welcome.",
  });
  expect(subject).toBe("News from Stacks");
  expect(html).toContain("Hi Maya");
  expect(html).toContain("Questions &amp; notes welcome.");
  expect(html).toContain("/notifications");
  // The front page's lending scene sits on top, covers through the site
  expect(html).toContain("Due soon");
  expect(html).toContain("/covers/b/isbn/9780063251922-M.jpg");
  // Turning these off is the email-notifications switch
  expect(html).toContain("k=requests");
  expect(text).toContain("Big updates: a public page for your shelf.\nQuestions & notes welcome.");
});
