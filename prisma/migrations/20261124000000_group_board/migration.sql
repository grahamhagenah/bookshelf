-- What a group can choose to keep on its page: the book it's reading, when
-- and where it meets, and a link to its group chat, all optional
ALTER TABLE "Group" ADD COLUMN "pickKey" TEXT;
ALTER TABLE "Group" ADD COLUMN "pickTitle" TEXT;
ALTER TABLE "Group" ADD COLUMN "pickAuthor" TEXT;
ALTER TABLE "Group" ADD COLUMN "pickCover" TEXT;
ALTER TABLE "Group" ADD COLUMN "pickedById" TEXT;
ALTER TABLE "Group" ADD COLUMN "pickedAt" DATETIME;
ALTER TABLE "Group" ADD COLUMN "meetsAt" DATETIME;
ALTER TABLE "Group" ADD COLUMN "meetPlace" TEXT;
ALTER TABLE "Group" ADD COLUMN "chatUrl" TEXT;
ALTER TABLE "Group" ADD COLUMN "boardById" TEXT;
ALTER TABLE "Group" ADD COLUMN "boardAt" DATETIME;
