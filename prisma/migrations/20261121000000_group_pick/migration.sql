-- What a group is reading now, and when it next meets
ALTER TABLE "Group" ADD COLUMN "pickKey" TEXT;
ALTER TABLE "Group" ADD COLUMN "pickTitle" TEXT;
ALTER TABLE "Group" ADD COLUMN "pickAuthor" TEXT;
ALTER TABLE "Group" ADD COLUMN "pickCover" TEXT;
ALTER TABLE "Group" ADD COLUMN "pickedById" TEXT;
ALTER TABLE "Group" ADD COLUMN "pickedAt" DATETIME;
ALTER TABLE "Group" ADD COLUMN "meetsAt" DATETIME;
