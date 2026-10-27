-- CreateTable
CREATE TABLE "OpenLibraryResponse" (
    "url" TEXT NOT NULL PRIMARY KEY,
    "body" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CatalogBook" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "coverId" INTEGER,
    "year" INTEGER,
    "pages" INTEGER,
    "subjects" TEXT,
    "publisher" TEXT,
    "editions" INTEGER,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "OpenLibraryResponse_fetchedAt_idx" ON "OpenLibraryResponse"("fetchedAt");


-- The catalog starts with every book already on a shelf or wanted, by
-- Open Library work; the shelf's details win over a want-to-read's
INSERT OR IGNORE INTO "CatalogBook" ("key", "title", "author", "coverId", "year", "pages", "subjects", "publisher", "updatedAt")
SELECT "openLibraryKey", "title", "author",
  CASE WHEN "cover" LIKE '%covers.openlibrary.org/b/id/%'
    THEN CAST(substr("cover", instr("cover", '/b/id/') + 6) AS INTEGER) END,
  CASE WHEN "datePublished" GLOB '[0-9][0-9][0-9][0-9]*'
    THEN CAST(substr("datePublished", 1, 4) AS INTEGER) END,
  "pageCount", "subjects", "publisher", CURRENT_TIMESTAMP
FROM "Book"
WHERE "openLibraryKey" LIKE '/works/%'
ORDER BY "createdAt";

INSERT OR IGNORE INTO "CatalogBook" ("key", "title", "author", "coverId", "updatedAt")
SELECT "openLibraryKey", "title", "author",
  CASE WHEN "cover" LIKE '%covers.openlibrary.org/b/id/%'
    THEN CAST(substr("cover", instr("cover", '/b/id/') + 6) AS INTEGER) END,
  CURRENT_TIMESTAMP
FROM "WantToRead"
WHERE "openLibraryKey" LIKE '/works/%';
