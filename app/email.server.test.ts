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
    headline: "Big updates",
    message: "A public page for your shelf.\n\nQuestions & notes welcome.",
  });
  expect(subject).toBe("Stacks: Big updates");
  expect(html).toContain("<h1");
  expect(html).toContain("Big updates</h1>");
  expect(html).toContain("Hi Maya");
  // A blank line starts a new paragraph
  expect(html).toContain("<p style=\"margin: 0 0 16px; white-space: pre-wrap; font-size: 16px; line-height: 1.55; color: #44403c;\">Questions &amp; notes welcome.</p>");
  expect(html).toContain("/notifications");
  // The front page's lending scene sits on top, covers through the site
  expect(html).toContain("Due soon");
  expect(html).toContain("/covers/b/isbn/9780063251922-M.jpg");
  // Turning these off is the email-notifications switch
  expect(html).toContain("k=requests");
  expect(text).toContain("BIG UPDATES\n\nHi Maya,\n\nA public page for your shelf.\n\nQuestions & notes welcome.");
});

test("without a headline the announcement still has its eyebrow and a plain subject", () => {
  const { subject, html } = renderAnnouncement({ toName: "Maya", message: "Hello" });
  expect(subject).toBe("News from Stacks");
  // The brand is in the masthead, over the books, and nowhere else
  expect(html.split("/icon-192.png").length - 1).toBe(1);
  expect(html).not.toContain("<h1");
});
