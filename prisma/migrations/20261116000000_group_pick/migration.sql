-- What a group's reading now
ALTER TABLE "Group" ADD COLUMN "pickKey" TEXT;
ALTER TABLE "Group" ADD COLUMN "pickTitle" TEXT;
ALTER TABLE "Group" ADD COLUMN "pickAuthor" TEXT;
ALTER TABLE "Group" ADD COLUMN "pickCover" TEXT;
ALTER TABLE "Group" ADD COLUMN "pickNote" TEXT;
ALTER TABLE "Group" ADD COLUMN "pickedAt" DATETIME;
