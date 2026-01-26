import { Resend } from "resend";

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
