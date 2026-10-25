-- A book can be kept off its owner's public page
ALTER TABLE "Book" ADD COLUMN "hiddenFromPage" BOOLEAN NOT NULL DEFAULT false;

-- Books pinned to the top of a public page
CREATE TABLE "Pin" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Pin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Pin_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Pin_userId_idx" ON "Pin"("userId");

CREATE UNIQUE INDEX "Pin_userId_bookId_key" ON "Pin"("userId", "bookId");
