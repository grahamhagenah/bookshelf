-- A list of names to lend to. Added as a column, so the User table isn't
-- rebuilt.
ALTER TABLE "User" ADD COLUMN "listedById" TEXT CONSTRAINT "User_listedById_fkey" REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "User_listedById_idx" ON "User"("listedById");

-- Everyone already lent to by name goes on the list of whoever lent to
-- them first
UPDATE "User"
SET "listedById" = (
  SELECT "Book"."userId"
  FROM "LendingHistory"
  JOIN "Book" ON "Book"."id" = "LendingHistory"."bookId"
  WHERE "LendingHistory"."borrowerId" = "User"."id"
  ORDER BY "LendingHistory"."borrowedAt" ASC
  LIMIT 1
)
WHERE "nameOnly" = 1;
