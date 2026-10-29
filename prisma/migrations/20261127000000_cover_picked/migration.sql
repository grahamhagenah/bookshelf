-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Book" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cover" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "datePublished" TEXT,
    "pageCount" INTEGER,
    "subjects" TEXT,
    "publisher" TEXT,
    "openLibraryKey" TEXT,
    "isbn" TEXT,
    "lendCount" INTEGER NOT NULL DEFAULT 0,
    "readAt" DATETIME,
    "firstSentence" TEXT,
    "authorKey" TEXT,
    "detailsFetchedAt" DATETIME,
    "hiddenFromPage" BOOLEAN NOT NULL DEFAULT false,
    "notLendingUntil" DATETIME,
    "coverPicked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "borrowerId" TEXT,
    "borrowedAt" DATETIME,
    "dueDate" DATETIME,
    CONSTRAINT "Book_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Book_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Book" ("author", "authorKey", "body", "borrowedAt", "borrowerId", "cover", "createdAt", "datePublished", "detailsFetchedAt", "dueDate", "firstSentence", "hiddenFromPage", "id", "isbn", "lendCount", "notLendingUntil", "openLibraryKey", "pageCount", "publisher", "readAt", "subjects", "title", "updatedAt", "userId") SELECT "author", "authorKey", "body", "borrowedAt", "borrowerId", "cover", "createdAt", "datePublished", "detailsFetchedAt", "dueDate", "firstSentence", "hiddenFromPage", "id", "isbn", "lendCount", "notLendingUntil", "openLibraryKey", "pageCount", "publisher", "readAt", "subjects", "title", "updatedAt", "userId" FROM "Book";
DROP TABLE "Book";
ALTER TABLE "new_Book" RENAME TO "Book";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Copies whose owner picked the cover: anything other than Open Library's
-- that isn't a cover someone else shared. A copy that got a shared cover
-- since replaced can't be told apart from a hand-picked one, and keeps it.
UPDATE "Book" SET "coverPicked" = true
WHERE "cover" <> ''
  AND "cover" NOT LIKE 'https://covers.openlibrary.org/%'
  AND NOT EXISTS (
    SELECT 1 FROM "SharedCover"
    WHERE "SharedCover"."cover" = "Book"."cover"
      AND "SharedCover"."userId" <> "Book"."userId"
  );
