-- CreateTable
CREATE TABLE "LendingHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "borrowedAt" DATETIME NOT NULL,
    "returnedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LendingHistory_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LendingHistory_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReaderNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loved" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT,
    "readAt" DATETIME,
    "bookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReaderNote_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReaderNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Author" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "birthDate" TEXT,
    "deathDate" TEXT,
    "wikipedia" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Hold" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Hold_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Hold_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WantToRead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "cover" TEXT NOT NULL,
    "openLibraryKey" TEXT,
    "isbn" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WantToRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Household" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "inviteToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "borrowerId" TEXT,
    "borrowedAt" DATETIME,
    "dueDate" DATETIME,
    CONSTRAINT "Book_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Book_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Book" ("author", "body", "borrowerId", "cover", "createdAt", "datePublished", "id", "openLibraryKey", "pageCount", "publisher", "subjects", "title", "updatedAt", "userId") SELECT "author", "body", "borrowerId", "cover", "createdAt", "datePublished", "id", "openLibraryKey", "pageCount", "publisher", "subjects", "title", "updatedAt", "userId" FROM "Book";
DROP TABLE "Book";
ALTER TABLE "new_Book" RENAME TO "Book";
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "firstname" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "shareToken" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "theme" TEXT,
    "libraryView" TEXT NOT NULL DEFAULT 'cover',
    "coverSize" TEXT NOT NULL DEFAULT 'large',
    "profileEmoji" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "demoGroup" TEXT,
    "householdId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "firstname", "id", "surname", "updatedAt") SELECT "createdAt", "email", "firstname", "id", "surname", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_shareToken_key" ON "User"("shareToken");
CREATE INDEX "demo_group_index" ON "User"("demoGroup");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;

-- CreateIndex
CREATE INDEX "lending_history_book_index" ON "LendingHistory"("bookId");

-- CreateIndex
CREATE INDEX "lending_history_borrower_index" ON "LendingHistory"("borrowerId");

-- CreateIndex
CREATE INDEX "reader_note_book_index" ON "ReaderNote"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "ReaderNote_bookId_userId_key" ON "ReaderNote"("bookId", "userId");

-- CreateIndex
CREATE INDEX "Hold_bookId_idx" ON "Hold"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "Hold_bookId_userId_key" ON "Hold"("bookId", "userId");

-- CreateIndex
CREATE INDEX "WantToRead_userId_idx" ON "WantToRead"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Household_inviteToken_key" ON "Household"("inviteToken");

