import { Resend } from "resend";

import type { Digest } from "~/models/digest.server";
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
function layout({ preheader, content, footer }: { preheader: string; content: string; footer: string }) {
  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin: 0; padding: 32px 16px; background: ${page}; font-family: ${font}; color: ${ink};">
    <div style="display: none; max-height: 0; overflow: hidden;">${esc(preheader)}</div>
    <div style="max-width: 560px; margin: 0 auto;">
      <a href="${APP_URL}" style="display: inline-block; margin: 0 0 16px; color: ${ink}; text-decoration: none;">
        <img src="${APP_URL}/icon-192.png" width="28" height="28" alt="" style="vertical-align: middle; border: 0;">
        <span style="vertical-align: middle; margin-left: 6px; font-size: 19px; font-weight: 600;">Stacks</span>
      </a>
      <div style="background: #ffffff; border: 1px solid ${line}; border-radius: 12px; padding: 28px 24px;">
        ${content}
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

const settingsFooter = `You get these because email is on in your ${footerLink(`${APP_URL}/account`, "account settings")}.`;

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

async function send(message: { to: string; subject: string; html: string; text: string }) {
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
  toName,
  requesterName,
  bookTitle,
  bookAuthor,
  bookCover,
}: {
  toName: string;
  requesterName: string;
  bookTitle: string;
  bookAuthor?: string | null;
  bookCover?: string | null;
}) {
  const link = `${APP_URL}/notifications`;
  const subject = `${requesterName} wants to borrow ${bookTitle}`;
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
        ${button(link, "See the request")}`,
    footer: `You can say yes or no from your notifications in Stacks. ${settingsFooter}`,
  });
  const text = `Hi ${toName},

${requesterName} would like to borrow ${bookTitle}${bookAuthor ? ` by ${bookAuthor}` : ""} from your shelf.

Say yes or no here: ${link}

You get these because email is on in your account settings: ${APP_URL}/account`;
  return { subject, html, text };
}

export async function sendBookRequestEmail({
  toEmail,
  ...details
}: Parameters<typeof renderBookRequest>[0] & { toEmail: string }) {
  // Demo sandbox addresses are undeliverable by design
  if (isDemoEmail(toEmail)) return { success: false, error: "Demo account" };
  return send({ to: toEmail, ...renderBookRequest(details) });
}

// ---- A temporary password ----

export function renderPasswordReset({ toName, tempPassword }: { toName: string; tempPassword: string }) {
  const link = `${APP_URL}/login`;
  const html = layout({
    preheader: "Your temporary password for Stacks.",
    content: `
        ${paragraph(`Hi ${esc(toName)}, here's a temporary password for your Stacks account:`)}
        <p style="margin: 0; padding: 16px; background: ${page}; border: 1px solid ${line}; border-radius: 8px; text-align: center; font-family: ui-monospace, Menlo, monospace; font-size: 22px; font-weight: 600; letter-spacing: 1px; color: ${ink};">${esc(tempPassword)}</p>
        <p style="margin: 16px 0 0; font-size: 16px; line-height: 1.55; color: ${body};">Sign in with it, then pick a new password in your account settings.</p>
        ${button(link, "Sign in")}`,
    footer: "If you didn't ask for this, ignore this email. Your password stays the same unless someone signs in with the one above.",
  });
  const text = `Hi ${toName},

Here's a temporary password for your Stacks account:

${tempPassword}

Sign in with it, then pick a new password in your account settings: ${link}

If you didn't ask for this, ignore this email. Your password stays the same unless someone signs in with the one above.`;
  return { subject: "Your temporary password for Stacks", html, text };
}

export async function sendPasswordResetEmail({
  toEmail,
  ...details
}: Parameters<typeof renderPasswordReset>[0] & { toEmail: string }) {
  // Demo sandbox addresses are undeliverable by design
  if (isDemoEmail(toEmail)) return { success: false, error: "Demo account" };
  if (!resend) console.log("Temporary password (email not configured):", details.tempPassword);
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

export function renderDigest({ toName, digest }: { toName: string; digest: Digest }) {
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
    footer: `You get this once a week because email is on in your ${footerLink(`${APP_URL}/account`, "account settings")}.`,
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
    `You get this once a week because email is on in your account settings: ${APP_URL}/account`,
  ].join("\n");

  const subject =
    lines.due.length > 0
      ? `Stacks: ${plural(lines.due.length, "book")} due back this week`
      : `Stacks: your week with ${plural(lines.activity.length + lines.wanted.length, "update")}`;
  return { subject, html, text };
}

export async function sendDigestEmail({
  toEmail,
  toName,
  digest,
}: {
  toEmail: string;
  toName: string;
  digest: Digest;
}) {
  if (isDemoEmail(toEmail)) return { success: false, error: "Demo account" };
  return send({ to: toEmail, ...renderDigest({ toName, digest }) });
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
