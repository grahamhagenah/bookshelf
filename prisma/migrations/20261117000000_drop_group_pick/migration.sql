-- The group's current pick is gone; its columns go with it, one by one,
-- so the table isn't rebuilt
ALTER TABLE "Group" DROP COLUMN "pickKey";
ALTER TABLE "Group" DROP COLUMN "pickTitle";
ALTER TABLE "Group" DROP COLUMN "pickAuthor";
ALTER TABLE "Group" DROP COLUMN "pickCover";
ALTER TABLE "Group" DROP COLUMN "pickNote";
ALTER TABLE "Group" DROP COLUMN "pickedAt";
