-- Accounts made for someone lent a book before they joined
ALTER TABLE "User" ADD COLUMN "invitedAt" DATETIME;
