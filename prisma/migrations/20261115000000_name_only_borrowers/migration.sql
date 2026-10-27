-- Someone lent a book by name only, with no email
ALTER TABLE "User" ADD COLUMN "nameOnly" BOOLEAN NOT NULL DEFAULT false;
