-- Admins choose how they hear about new sign-ups and feedback. Plain
-- added columns with defaults, so existing rows need nothing.
ALTER TABLE "User" ADD COLUMN "adminSignupEmails" TEXT NOT NULL DEFAULT 'each';
ALTER TABLE "User" ADD COLUMN "adminFeedbackEmails" BOOLEAN NOT NULL DEFAULT true;
