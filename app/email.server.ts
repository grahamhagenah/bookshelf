import { Resend } from "resend";

import type { Digest } from "~/models/digest.server";
import { isDemoEmail } from "~/utils";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const APP_URL = process.env.APP_URL || "http://localhost:3000";
const FROM_EMAIL = process.env.FROM_EMAIL || "Stacks <onboarding@resend.dev>";

export async function sendBookRequestEmail({
  toEmail,
  toName,
  requesterName,
  bookTitle,
}: {
  toEmail: string;
  toName: string;
  requesterName: string;
  bookTitle: string;
}) {
  // Demo sandbox addresses are undeliverable by design
  if (isDemoEmail(toEmail)) {
    return { success: false, error: "Demo account" };
  }

  if (!resend) {
    console.log("Email not sent (RESEND_API_KEY not configured):", {
      to: toEmail,
      subject: `Book Request: ${bookTitle}`,
    });
    return { success: false, error: "Email service not configured" };
  }

  const notificationsUrl = `${APP_URL}/notifications`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: `Book Request: ${bookTitle}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Stacks</h1>
            </div>

            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <h2 style="color: #1f2937; margin-top: 0;">Hi ${toName},</h2>

              <p style="color: #4b5563; font-size: 16px;">
                <strong>${requesterName}</strong> would like to borrow your book:
              </p>

              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <p style="font-size: 20px; font-weight: 600; color: #1f2937; margin: 0;">
                  "${bookTitle}"
                </p>
              </div>

              <p style="color: #4b5563; font-size: 16px;">
                Click the button below to approve or decline this request:
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${notificationsUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  View Request
                </a>
              </div>

              <p style="color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                You're receiving this email because someone requested to borrow a book from your Stacks library.
              </p>
            </div>
          </body>
        </html>
      `,
      text: `Hi ${toName},

${requesterName} would like to borrow your book: "${bookTitle}"

Click the link below to approve or decline this request:
${notificationsUrl}

You're receiving this email because someone requested to borrow a book from your Stacks library.`,
    });

    if (error) {
      console.error("Failed to send email:", error);
      return { success: false, error: error.message };
    }

    console.log("Email sent successfully:", data?.id);
    return { success: true, id: data?.id };
  } catch (error) {
    console.error("Error sending email:", error);
    return { success: false, error: String(error) };
  }
}

export async function sendPasswordResetEmail({
  toEmail,
  toName,
  tempPassword,
}: {
  toEmail: string;
  toName: string;
  tempPassword: string;
}) {
  // Demo sandbox addresses are undeliverable by design
  if (isDemoEmail(toEmail)) {
    return { success: false, error: "Demo account" };
  }

  if (!resend) {
    console.log("Email not sent (RESEND_API_KEY not configured):", {
      to: toEmail,
      subject: "Your Temporary Password",
      tempPassword,
    });
    return { success: false, error: "Email service not configured" };
  }

  const loginUrl = `${APP_URL}/login`;

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: toEmail,
      subject: "Your Temporary Password - Stacks",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Stacks</h1>
            </div>

            <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <h2 style="color: #1f2937; margin-top: 0;">Hi ${toName},</h2>

              <p style="color: #4b5563; font-size: 16px;">
                You requested a password reset for your Stacks account. Here's your temporary password:
              </p>

              <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center;">
                <p style="font-size: 24px; font-weight: 600; color: #1f2937; margin: 0; font-family: monospace; letter-spacing: 2px;">
                  ${tempPassword}
                </p>
              </div>

              <p style="color: #4b5563; font-size: 16px;">
                Use this password to log in, then change it to something memorable in your Account settings.
              </p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${loginUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                  Log In
                </a>
              </div>

              <p style="color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                If you didn't request this password reset, please ignore this email. Your password will remain unchanged unless you use the temporary password above.
              </p>
            </div>
          </body>
        </html>
      `,
      text: `Hi ${toName},

You requested a password reset for your Stacks account. Here's your temporary password:

${tempPassword}

Use this password to log in, then change it to something memorable in your Account settings.

Log in at: ${loginUrl}

If you didn't request this password reset, please ignore this email. Your password will remain unchanged unless you use the temporary password above.`,
    });

    if (error) {
      console.error("Failed to send password reset email:", error);
      return { success: false, error: error.message };
    }

    console.log("Password reset email sent successfully:", data?.id);
    return { success: true, id: data?.id };
  } catch (error) {
    console.error("Error sending password reset email:", error);
    return { success: false, error: String(error) };
  }
}

// ---- The weekly digest ----

const esc = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const plural = (n: number, word: string) => `${n} ${n === 1 ? word : `${word}s`}`;

// "in 2 days", "tomorrow", "today", "3 days late"
function dueWords(days: number) {
  if (days < 0) return `${plural(-days, "day")} late`;
  if (days === 0) return "due today";
  if (days === 1) return "due tomorrow";
  return `due in ${days} days`;
}

// The email as lines of plain text and HTML list items, so both versions
// say the same thing
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

export function renderDigest({ toName, digest }: { toName: string; digest: Digest }) {
  const lines = digestLines(digest);
  const sections: [string, string[], string][] = [
    ["Due back", lines.due, `${APP_URL}/`],
    ["From your want-to-read list", lines.wanted, `${APP_URL}/want-to-read`],
    ["This week from your friends", lines.activity, `${APP_URL}/feed`],
  ];
  const filled = sections.filter(([, items]) => items.length > 0);

  const html = `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
  <body style="margin: 0; padding: 24px 16px; background: #fafaf9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1c1917;">
    <div style="max-width: 560px; margin: 0 auto;">
      <p style="margin: 0 0 20px; font-size: 18px; font-weight: 600;">Stacks</p>
      <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.5; color: #44403c;">Hi ${esc(toName)}, here's your week.</p>
      ${filled
        .map(
          ([title, items, link]) => `
      <h2 style="margin: 24px 0 8px; font-size: 13px; font-weight: 600; letter-spacing: 0.02em; color: #78716c;">${esc(title)}</h2>
      <ul style="margin: 0; padding: 0; list-style: none;">
        ${items
          .map(
            (line) =>
              `<li style="padding: 8px 0; border-top: 1px solid #e7e5e4; font-size: 15px; line-height: 1.5;">${esc(line)}</li>`,
          )
          .join("")}
      </ul>
      <p style="margin: 8px 0 0;"><a href="${link}" style="font-size: 14px; color: #44403c;">Open in Stacks →</a></p>`,
        )
        .join("")}
      <p style="margin: 32px 0 0; padding-top: 16px; border-top: 1px solid #e7e5e4; font-size: 12px; line-height: 1.5; color: #a8a29e;">
        You get this once a week because email is on in your <a href="${APP_URL}/account" style="color: #78716c;">account settings</a>.
      </p>
    </div>
  </body>
</html>`;

  const text = [
    `Hi ${toName}, here's your week on Stacks.`,
    ...filled.flatMap(([title, items, link]) => ["", title.toUpperCase(), ...items.map((line) => `- ${line}`), link]),
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
  const { subject, html, text } = renderDigest({ toName, digest });
  if (!resend) {
    console.log("Email not sent (RESEND_API_KEY not configured):", { to: toEmail, subject });
    return { success: false, error: "Email service not configured" };
  }
  try {
    const { data, error } = await resend.emails.send({ from: FROM_EMAIL, to: toEmail, subject, html, text });
    if (error) return { success: false, error: error.message };
    return { success: true, id: data?.id };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}
