-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "firstname" TEXT NOT NULL,
    "surname" TEXT NOT NULL,
    "shareToken" TEXT,
    "friendInvite" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "darkMode" BOOLEAN NOT NULL DEFAULT false,
    "theme" TEXT,
    "libraryView" TEXT NOT NULL DEFAULT 'cover',
    "coverSize" TEXT NOT NULL DEFAULT 'large',
    "profileEmoji" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT true,
    "emailVerifiedAt" DATETIME,
    "verificationSentAt" DATETIME,
    "demoGroup" TEXT,
    "householdId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("coverSize", "createdAt", "darkMode", "demoGroup", "email", "emailNotifications", "emailVerifiedAt", "firstname", "friendInvite", "householdId", "id", "isAdmin", "libraryView", "profileEmoji", "shareToken", "surname", "theme", "updatedAt", "verificationSentAt") SELECT "coverSize", "createdAt", "darkMode", "demoGroup", "email", "emailNotifications", "emailVerifiedAt", "firstname", "friendInvite", "householdId", "id", "isAdmin", "libraryView", "profileEmoji", "shareToken", "surname", "theme", "updatedAt", "verificationSentAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_shareToken_key" ON "User"("shareToken");
CREATE UNIQUE INDEX "User_friendInvite_key" ON "User"("friendInvite");
CREATE INDEX "demo_group_index" ON "User"("demoGroup");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;


-- Anyone who had turned email off keeps the roundup off too
UPDATE "User" SET "weeklyDigest" = "emailNotifications";
