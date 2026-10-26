-- CreateTable
CREATE TABLE "FeedMute" (
    "userId" TEXT NOT NULL,
    "mutedId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("userId", "mutedId"),
    CONSTRAINT "FeedMute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeedMute_mutedId_fkey" FOREIGN KEY ("mutedId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

