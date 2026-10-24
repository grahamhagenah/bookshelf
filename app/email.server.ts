import { Resend } from "resend";

import type { Digest } from "~/models/digest.server";
import type { EmailKind } from "~/models/user.server";
import { unsubscribeUrl } from "~/unsubscribe.server";
import { coverSrc, isDemoEmail } from "~/utils";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const FROM_EMAIL = process.env.FROM_EMAIL || "Stacks <onboarding@resend.dev>";

// ---- One look for every email ----
// The site's stone palette and its one green, inline because email clients
// drop stylesheets

const ink = "#1c1917";
const body = "#44403c";
const muted = "#78716c";
const faint = "#a8a29e";
const line = "#e7e5e4";
const page = "#fafaf9";
const green = "#1f6b4e";
const red = "#b91c1c";
const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const esc = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

// The logo and name, a white card for the message, and a quiet footer.
// The preheader is the line inboxes show beside the subject.
// The wordmark, linking home: a picture, since mail clients don't load
// the serif. It's drawn at twice this size, 150 by 45, for sharp screens.
const brand = (width: number, margin = "0") => `
      <a href="${APP_URL}" style="display: inline-block; margin: ${margin};"><img src="${APP_URL}/wordmark.png" width="${width}" height="${Math.round((width * 45) / 150)}" alt="Stacks" style="display: block; border: 0;"></a>`;

function layout({
  preheader,
  masthead = "",
  content,
  footer,
}: {
  preheader: string;
  // A full-bleed strip at the top of the card, above the message. It
  // carries the brand itself, so none goes above the card.
  masthead?: string;
  content: string;
  footer: string;
}) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>@media (max-width: 480px) { .phone { display: block !important; } .wide { display: none !important; } }</style>
  </head>
  <body style="margin: 0; padding: 32px 16px; background: ${page}; font-family: ${font}; color: ${ink};">
    <div style="display: none; max-height: 0; overflow: hidden;">${esc(preheader)}</div>
    <div style="max-width: 560px; margin: 0 auto;">
      ${masthead ? "" : brand(80, "0 0 16px")}
      <div style="background: #ffffff; border: 1px solid ${line}; border-radius: 12px; overflow: hidden;">
        ${masthead}
        <div style="padding: 28px 24px;">
        ${content}
        </div>
      </div>
      <p style="margin: 16px 4px 0; font-size: 12px; line-height: 1.5; color: ${faint};">${footer}</p>
    </div>
  </body>
</html>`;
}

const paragraph = (html: string) =>
  `<p style="margin: 0 0 16px; font-size: 16px; line-height: 1.55; color: ${body};">${html}</p>`;

function button(href: string, label: string) {
  return `<p style="margin: 24px 0 0;"><a href="${href}" style="display: inline-block; background: ${green}; color: #ffffff; padding: 12px 22px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600;">${esc(label)}</a></p>`;
}

const footerLink = (href: string, label: string) =>
  `<a href="${href}" style="color: ${muted};">${esc(label)}</a>`;

// Every email someone can opt out of ends with a link that turns off just
// that kind, no sign-in needed, beside a link to all their settings
const optOutFooter = (userId: string | undefined, kind: EmailKind, label: string) =>
  [
    userId ? footerLink(unsubscribeUrl(userId, kind), label) : null,
    footerLink(`${APP_URL}/account`, "Email settings"),
  ]
    .filter(Boolean)
    .join(" · ");

const optOutText = (userId: string | undefined, kind: EmailKind, label: string) =>
  userId ? `${label}: ${unsubscribeUrl(userId, kind)}` : `Email settings: ${APP_URL}/account`;

// Lets inboxes show their own Unsubscribe button (RFC 8058)
const optOutHeaders = (userId: string, kind: EmailKind) => ({
  "List-Unsubscribe": `<${unsubscribeUrl(userId, kind)}>`,
  "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
});

// Covers go out as full addresses; a book without one gets a plain tile
function cover(url: string | null | undefined, width: number) {
  const height = Math.round(width * 1.5);
  const box = `width: ${width}px; height: ${height}px; border-radius: 3px;`;
  if (!url) return `<div style="${box} background: #f5f5f4; border: 1px solid ${line};"></div>`;
  const src = coverSrc(url, "M");
  const absolute = src.startsWith("/") ? `${APP_URL}${src}` : src;
  return `<img src="${absolute}" width="${width}" height="${height}" alt="" style="${box} display: block; object-fit: cover; background: #f5f5f4; border: 0;">`;
}

const bookLink = (id: string | null, title: string) =>
  id
    ? `<a href="${APP_URL}/books/${id}" style="color: ${ink}; font-weight: 600; text-decoration: none;">${esc(title)}</a>`
    : `<strong style="color: ${ink};">${esc(title)}</strong>`;

async function send(message: {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}) {
  if (!resend) {
    console.log("Email not sent (RESEND_API_KEY not configured):", { to: message.to, subject: message.subject });
    return { success: false, error: "Email service not configured" };
  }
  try {
    const { data, error } = await resend.emails.send({ from: FROM_EMAIL, ...message });
    if (error) {
      console.error("Failed to send email:", error);
      return { success: false, error: error.message };
    }
    return { success: true, id: data?.id };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: String(error) };
  }
}

// ---- Someone wants to borrow a book ----

export function renderBookRequest({
  toUserId,
  toName,
  requesterName,
  bookTitle,
  bookAuthor,
  bookCover,
  message,
}: {
  toUserId?: string;
  toName: string;
  requesterName: string;
  bookTitle: string;
  bookAuthor?: string | null;
  bookCover?: string | null;
  // What the borrower said with the request
  message?: string | null;
}) {
  const link = `${APP_URL}/notifications`;
  const subject = `${requesterName} wants to borrow ${bookTitle}`;
  const note = message?.trim() || null;
  const html = layout({
    preheader: `Say yes or no from your notifications.`,
    content: `
        ${paragraph(`Hi ${esc(toName)}, <strong style="color: ${ink};">${esc(requesterName)}</strong> would like to borrow a book from your shelf.`)}
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 8px 0 0; border-collapse: collapse;">
          <tr>
            <td style="padding: 0 16px 0 0; vertical-align: top;">${cover(bookCover, 64)}</td>
            <td style="vertical-align: middle;">
              <p style="margin: 0; font-size: 18px; font-weight: 600; line-height: 1.3; color: ${ink};">${esc(bookTitle)}</p>
              ${bookAuthor ? `<p style="margin: 4px 0 0; font-size: 15px; color: ${muted};">${esc(bookAuthor)}</p>` : ""}
            </td>
          </tr>
        </table>
        ${note ? `<blockquote style="margin: 16px 0 0; padding: 0 0 0 12px; border-left: 2px solid ${line}; font-size: 15px; line-height: 1.5; color: ${body}; white-space: pre-wrap;">${esc(note)}</blockquote>` : ""}
        ${button(link, "See the request")}`,
    footer: optOutFooter(toUserId, "requests", "Stop emails about borrow requests"),
  });
  const text = `Hi ${toName},

${requesterName} would like to borrow ${bookTitle}${bookAuthor ? ` by ${bookAuthor}` : ""} from your shelf.
${note ? `\nThey said: ${note}\n` : ""}
Say yes or no here: ${link}

${optOutText(toUserId, "requests", "Stop emails about borrow requests")}`;
  return { subject, html, text };
}

export async function sendBookRequestEmail({
  toEmail,
  ...details
}: Parameters<typeof renderBookRequest>[0] & { toEmail: string; toUserId: string }) {
  // Demo sandbox addresses are undeliverable by design
  if (isDemoEmail(toEmail)) return { success: false, error: "Demo account" };
  return send({
    to: toEmail,
    ...renderBookRequest(details),
    headers: optOutHeaders(details.toUserId, "requests"),
  });
}

// ---- A link to choose a new password ----

export function renderPasswordReset({ toName, token }: { toName: string; token: string }) {
  const link = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const html = layout({
    preheader: "Choose a new password for Stacks.",
    content: `
        ${paragraph(`Hi ${esc(toName)}, someone asked to reset the password for your Stacks account. If it was you, tap the button to choose a new one.`)}
        ${button(link, "Choose a new password")}`,
    footer: "The link works for an hour, and only once. If you didn't ask for this, ignore this email: your password hasn't changed.",
  });
  const text = `Hi ${toName},

Someone asked to reset the password for your Stacks account. If it was you, choose a new one here:

${link}

The link works for an hour, and only once. If you didn't ask for this, ignore this email: your password hasn't changed.`;
  return { subject: "Reset your Stacks password", html, text };
}

export async function sendPasswordResetEmail({
  toEmail,
  ...details
}: Parameters<typeof renderPasswordReset>[0] & { toEmail: string }) {
  // Demo sandbox addresses are undeliverable by design
  if (isDemoEmail(toEmail)) return { success: false, error: "Demo account" };
  if (!resend) console.log("Password reset link (email not configured):", renderPasswordReset(details).text.split("\n")[4]);
  return send({ to: toEmail, ...renderPasswordReset(details) });
}

// ---- The weekly digest ----

// "due in 2 days", "due tomorrow", "due today", "3 days late"
function dueWords(days: number) {
  if (days < 0) return `${plural(-days, "day")} late`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due in ${days} days`;
}

// The plain-text version, line by line
function digestLines(digest: Digest) {
  const activity = digest.activity.map((item) => {
    const name = `${item.friend.firstname} ${item.friend.surname}`;
    if (item.kind === "added") {
      const titles = item.books.slice(0, 3).map((book) => book.title);
      const more = item.books.length - titles.length;
      return `${name} added ${item.books.length === 1 ? "" : `${item.books.length} books: `}${titles.join(", ")}${more > 0 ? ` and ${more} more` : ""}`;
    }
    if (item.kind === "loved") return `${name} loved ${item.book.title}`;
    return `${name} wrote about ${item.book.title}${item.body ? `: “${item.body}”` : ""}`;
  });
  const due = digest.due.map(
    (item) =>
      `${item.title} · ${item.direction === "borrowed" ? "back to" : "with"} ${item.person} · ${dueWords(item.days)}`,
  );
  const wanted = digest.wanted.map((item) => `${item.friend} added ${item.title}`);
  return { activity, due, wanted };
}

const rowStyle = `padding: 12px 0; border-top: 1px solid ${line}; vertical-align: top;`;

function rows(cells: string[]) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">${cells
    .map((cell) => `<tr>${cell}</tr>`)
    .join("")}</table>`;
}

// A small cover beside a line or two of text
const withCover = (coverUrl: string | null, text: string) =>
  `<td style="${rowStyle} width: 48px; padding-right: 12px;">${cover(coverUrl, 36)}</td><td style="${rowStyle} font-size: 15px; line-height: 1.5; color: ${body};">${text}</td>`;

const textOnly = (text: string) =>
  `<td colspan="2" style="${rowStyle} font-size: 15px; line-height: 1.5; color: ${body};">${text}</td>`;

function dueRow(item: Digest["due"][number]) {
  const who = `${item.direction === "borrowed" ? "Back to" : "With"} ${esc(item.person)}`;
  const when =
    item.days < 0
      ? `<span style="color: ${red}; font-weight: 600;">${dueWords(item.days)}</span>`
      : dueWords(item.days);
  return withCover(item.cover, `${bookLink(item.bookId, item.title)}<br><span style="font-size: 14px; color: ${muted};">${who} · ${when}</span>`);
}

function activityRow(item: Digest["activity"][number]) {
  const name = `<strong style="color: ${ink};">${esc(`${item.friend.firstname} ${item.friend.surname}`)}</strong>`;
  if (item.kind === "added") {
    if (item.books.length === 1) {
      const [book] = item.books;
      return withCover(book.cover, `${name} added ${bookLink(book.id, book.title)}<br><span style="font-size: 14px; color: ${muted};">${esc(book.author)}</span>`);
    }
    // A row of up to four covers, each linking to its book
    const shown = item.books.slice(0, 4);
    const more = item.books.length - shown.length;
    const covers = shown
      .map(
        (book) =>
          `<td style="padding: 8px 8px 0 0; vertical-align: top;"><a href="${APP_URL}/books/${book.id}" title="${esc(book.title)}">${cover(book.cover, 44)}</a></td>`,
      )
      .join("");
    return textOnly(
      `${name} added ${plural(item.books.length, "book")}${more > 0 ? `, including these` : ""}
      <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse;"><tr>${covers}</tr></table>`,
    );
  }
  if (item.kind === "loved") {
    return withCover(item.book.cover, `${name} loved ${bookLink(item.book.id, item.book.title)} <span style="color: #e11d48;">♥</span>`);
  }
  const quote = item.body
    ? `<br><span style="display: inline-block; margin-top: 6px; padding-left: 10px; border-left: 2px solid ${line}; font-style: italic; color: ${body};">“${esc(item.body)}”</span>`
    : "";
  return withCover(item.book.cover, `${name} wrote about ${bookLink(item.book.id, item.book.title)}${quote}`);
}

function wantedRow(item: Digest["wanted"][number]) {
  return textOnly(`<strong style="color: ${ink};">${esc(item.friend)}</strong> added ${bookLink(item.bookId, item.title)}, which is on your want-to-read list`);
}

export function renderDigest({
  toUserId,
  toName,
  digest,
}: {
  toUserId?: string;
  toName: string;
  digest: Digest;
}) {
  const lines = digestLines(digest);
  const sections: [string, string[], string][] = [
    ["Due back", digest.due.map(dueRow), `${APP_URL}/`],
    ["From your want-to-read list", digest.wanted.map(wantedRow), `${APP_URL}/want-to-read`],
    ["This week from your friends", digest.activity.map(activityRow), `${APP_URL}/feed`],
  ];
  const filled = sections.filter(([, cells]) => cells.length > 0);

  const html = layout({
    preheader:
      lines.due.length > 0
        ? `${plural(lines.due.length, "book")} due back, and what your friends have been reading.`
        : "What your friends have been reading this week.",
    content: `
        <p style="margin: 0; font-size: 16px; line-height: 1.55; color: ${body};">Hi ${esc(toName)}, here's your week.</p>
        ${filled
          .map(
            ([title, cells, link]) => `
        <h2 style="margin: 28px 0 4px; font-size: 13px; font-weight: 600; letter-spacing: 0.02em; color: ${muted};">${esc(title)}</h2>
        ${rows(cells)}
        <p style="margin: 4px 0 0;"><a href="${link}" style="font-size: 14px; font-weight: 600; color: ${green}; text-decoration: none;">Open in Stacks →</a></p>`,
          )
          .join("")}`,
    footer: optOutFooter(toUserId, "weekly", "Stop the weekly roundup"),
  });

  const text = [
    `Hi ${toName}, here's your week on Stacks.`,
    ...[
      ["Due back", lines.due, `${APP_URL}/`] as const,
      ["From your want-to-read list", lines.wanted, `${APP_URL}/want-to-read`] as const,
      ["This week from your friends", lines.activity, `${APP_URL}/feed`] as const,
    ]
      .filter(([, items]) => items.length > 0)
      .flatMap(([title, items, link]) => ["", title.toUpperCase(), ...items.map((item) => `- ${item}`), link]),
    "",
    optOutText(toUserId, "weekly", "Stop the weekly roundup"),
  ].join("\n");

  const subject =
    lines.due.length > 0
      ? `Stacks: ${plural(lines.due.length, "book")} due back this week`
      : `Stacks: your week with ${plural(lines.activity.length + lines.wanted.length, "update")}`;
  return { subject, html, text };
}

export async function sendDigestEmail({
  toEmail,
  ...details
}: Parameters<typeof renderDigest>[0] & { toEmail: string; toUserId: string }) {
  if (isDemoEmail(toEmail)) return { success: false, error: "Demo account" };
  return send({
    to: toEmail,
    ...renderDigest(details),
    headers: optOutHeaders(details.toUserId, "weekly"),
  });
}

// ---- The homepage's lending scene, as a strip for the top of an email ----

// Three books from the front page stand on the card's edge like a shelf,
// different heights, under the mark and name, after the "Due soon" note
// and the reminder that's gone out. Tables and plain boxes only: no tilt, since mail clients
// drop transforms.
const SCENE_COVERS = [
  { isbn: "9780063251922", width: 60 },
  { isbn: "9780593321447", width: 70 },
  { isbn: "9780670026197", width: 64 },
];

function scene() {
  const books = SCENE_COVERS.map(
    ({ isbn, width }) =>
      `<td style="padding: 0 8px 0 0; vertical-align: bottom;">${cover(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`, width).replace("border-radius: 3px;", "border-radius: 3px 3px 0 0;")}</td>`,
  ).join("");
  const name = (text: string) => `<strong style="color: ${ink};">${esc(text)}</strong>`;
  const note = `
    <div style="background: #ffffff; border: 1px solid ${line}; border-radius: 8px; padding: 10px 12px; font-size: 13px; line-height: 1.45; color: ${body};">
      <p style="margin: 0 0 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; color: ${muted};">Due soon</p>
      <p style="margin: 0;">${name("Demon Copperhead")} is with Anika · ${name("3 days late")}</p>
      <p style="margin: 2px 0 0;">${name("Sea of Tranquility")} goes back to Maya · tomorrow</p>
    </div>
    <p style="margin: 10px 0 0;"><span style="display: inline-block; background: ${ink}; color: #ffffff; border-radius: 999px; padding: 5px 11px; font-size: 12px; font-weight: 600;">&#10003;&nbsp; Reminder sent to Anika</span></p>`;
  // Two blocks side by side; on a narrow screen the covers drop under the
  // note and still stand on the line, and the wordmark moves to the top,
  // by the one media query mail clients honor
  return `
      <div style="background: ${page}; border-bottom: 1px solid ${line}; padding: 20px 24px 0; font-size: 0; line-height: 0;">
        <div class="phone" style="display: none; margin: 0 0 18px;">${brand(75)}</div>
        <div style="display: inline-block; vertical-align: bottom; width: 270px; max-width: 100%; margin: 0 16px 16px 0; font-size: 13px; line-height: 1.45;">${note}</div>
        <div style="display: inline-block; vertical-align: bottom; white-space: nowrap;">
          <div class="wide" style="margin: 0 0 18px; line-height: 0;">${brand(75)}</div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse: collapse;"><tr>${books}</tr></table>
        </div>
      </div>`;
}

// ---- A word from Stacks to everyone ----

// The same message that lands in Activity, as an email. It goes out under
// the email-notifications switch, so the opt-out link turns that off.
export function renderAnnouncement({
  toUserId,
  toName,
  headline,
  message,
}: {
  toUserId?: string;
  toName: string;
  // A short title above the message, and the subject
  headline?: string | null;
  message: string;
}) {
  const link = `${APP_URL}/notifications`;
  const title = headline?.trim() || "";
  // Blank lines in the message are paragraph breaks
  const paragraphs = message.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const html = layout({
    preheader: (title ? `${title}. ` : "") + message.slice(0, 120),
    masthead: scene(),
    content: `
        ${title ? `<h1 style="margin: 0 0 14px; font-size: 24px; line-height: 1.25; font-weight: 600; color: ${ink};">${esc(title)}</h1>` : ""}
        ${paragraph(`Hi ${esc(toName)},`)}
        ${paragraphs
          .map(
            (part) =>
              `<p style="margin: 0 0 16px; white-space: pre-wrap; font-size: 16px; line-height: 1.55; color: ${body};">${esc(part)}</p>`,
          )
          .join("")}
        ${button(link, "Open Stacks")}`,
    footer: optOutFooter(toUserId, "requests", "Stop email notifications"),
  });
  const text = `${title ? `${title.toUpperCase()}\n\n` : ""}Hi ${toName},

${message}

${link}

${optOutText(toUserId, "requests", "Stop email notifications")}`;
  return { subject: title ? `Stacks: ${title}` : "News from Stacks", html, text };
}

export async function sendAnnouncementEmail({
  toEmail,
  ...details
}: Parameters<typeof renderAnnouncement>[0] & { toEmail: string; toUserId: string }) {
  if (isDemoEmail(toEmail)) return { success: false, error: "Demo account" };
  return send({
    to: toEmail,
    ...renderAnnouncement(details),
    headers: optOutHeaders(details.toUserId, "requests"),
  });
}

// ---- A note to the admins when someone sends feedback ----

export function renderFeedback({ from, body: message, page: sentFrom }: { from: string; body: string; page: string | null }) {
  const subject = `Feedback from ${from.replace(/ <.*>$/, "")}`;
  const html = layout({
    preheader: message.slice(0, 120),
    content: `
        <p style="margin: 0 0 12px; font-size: 14px; color: ${muted};">${esc(from)} wrote:</p>
        <p style="margin: 0; white-space: pre-wrap; font-size: 16px; line-height: 1.55; color: ${ink};">${esc(message)}</p>
        ${sentFrom ? `<p style="margin: 16px 0 0; font-size: 13px; color: ${muted};">Sent from ${esc(sentFrom)}</p>` : ""}
        ${button(`${APP_URL}/dashboard#feedback`, "See all feedback")}`,
    footer: "You get these because you're an admin of Stacks.",
  });
  const text = `${from} wrote:\n\n${message}\n\n${sentFrom ? `Sent from ${sentFrom}\n` : ""}${APP_URL}/dashboard#feedback`;
  return { subject, html, text };
}

export async function sendFeedbackEmail({
  toEmail,
  ...details
}: Parameters<typeof renderFeedback>[0] & { toEmail: string }) {
  return send({ to: toEmail, ...renderFeedback(details) });
}

// ---- The link that confirms an address is really theirs ----

export function renderVerification({ toName, token }: { toName: string; token: string }) {
  const link = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  const html = layout({
    preheader: "One tap to confirm your email for Stacks.",
    content: `
        ${paragraph(`Hi ${esc(toName)}, tap the button to confirm this is your email address. Then Stacks can let you know when friends want to borrow your books.`)}
        ${button(link, "Confirm email")}`,
    footer: "The link works for a week. If you didn't sign up for Stacks, ignore this email and nothing will happen.",
  });
  const text = `Hi ${toName}, confirm this is your email address for Stacks:\n\n${link}\n\nThe link works for a week. If you didn't sign up for Stacks, ignore this email and nothing will happen.`;
  return { subject: "Confirm your email for Stacks", html, text };
}

export async function sendVerificationEmail({
  toEmail,
  ...details
}: Parameters<typeof renderVerification>[0] & { toEmail: string }) {
  if (isDemoEmail(toEmail)) return { success: false, error: "Demo account" };
  if (!resend) console.log("Verification link (email not configured):", renderVerification(details).text.split("\n")[2]);
  return send({ to: toEmail, ...renderVerification(details) });
}
