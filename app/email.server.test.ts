// @vitest-environment node
import { renderAnnouncement, renderBookRequest, renderLoanInvite, renderRequestAnswer, renderVerification } from "~/email.server";

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
  // The brand is in the masthead, once for wide screens and once for
  // phones, and not above the card
  expect(html.split("wordmark").length - 1).toBe(2);
  expect(html.indexOf("wordmark")).toBeGreaterThan(html.indexOf("border-bottom: 1px solid"));
  expect(html).not.toContain("<h1");
});

test("a borrow request carries the borrower's note, escaped", () => {
  const { html, text } = renderBookRequest({
    toName: "Maya",
    requesterName: "Sam Okafor",
    bookTitle: "Piranesi",
    message: "Could I grab it Saturday & keep it two weeks?",
  });
  expect(html).toContain("Could I grab it Saturday &amp; keep it two weeks?");
  expect(text).toContain("They said: Could I grab it Saturday & keep it two weeks?");
});

test("the answer to a request says yes or no, with the owner's note", () => {
  const { subject, html } = renderRequestAnswer({
    toName: "Sam",
    ownerName: "Maya Chen",
    bookTitle: "Piranesi",
    bookId: "b1",
    approved: true,
    message: "On the porch Saturday & yours for a month.",
  });
  expect(subject).toBe("Maya Chen is lending you Piranesi");
  expect(html).toContain("On the porch Saturday &amp; yours for a month.");
  expect(html).toContain("/books/b1");
});

test("a declined request says so, and points at Activity", () => {
  const { subject, html } = renderRequestAnswer({
    toName: "Sam",
    ownerName: "Maya Chen",
    bookTitle: "Piranesi",
    approved: false,
  });
  expect(subject).toBe("Maya Chen can't lend Piranesi right now");
  expect(html).toContain("/notifications");
  expect(html).not.toContain("<blockquote");
});

test("a loan to someone not on Stacks says whose book, when it's due, and links to the loan", () => {
  const { subject, html, text } = renderLoanInvite({
    toName: "Maya",
    token: "abc.def",
    loans: [
      { title: "Piranesi", author: "Susanna Clarke", lenderName: "Jordan Lee", dueDate: new Date("2026-11-15T12:00:00Z") },
      { title: "Tom & Jerry", author: "Someone", lenderName: "Sam Okafor", dueDate: null },
    ],
  });
  expect(subject).toBe("Jordan Lee lent you Piranesi");
  expect(text).toContain("due back on November 15");
  expect(text).toContain("/lent/abc.def");
  expect(html).toContain("Tom &amp; Jerry");
  expect(html).toContain("know Jordan Lee, ignore this email");
});
