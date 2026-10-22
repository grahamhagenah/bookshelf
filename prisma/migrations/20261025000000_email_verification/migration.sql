-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "verificationSentAt" DATETIME;

-- Accounts from before verification that someone actually uses (books,
-- friends, a shared shelf or a borrowed book) count as confirmed. The rest
-- are asked to confirm, and get no email until they do.
UPDATE "User" SET "emailVerifiedAt" = CURRENT_TIMESTAMP
WHERE "demoGroup" IS NULL AND (
  "householdId" IS NOT NULL
  OR EXISTS (SELECT 1 FROM "Book" WHERE "Book"."userId" = "User"."id")
  OR EXISTS (SELECT 1 FROM "Book" WHERE "Book"."borrowerId" = "User"."id")
  OR EXISTS (SELECT 1 FROM "_UserFollows" WHERE "A" = "User"."id" OR "B" = "User"."id")
);
