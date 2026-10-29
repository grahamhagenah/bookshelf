-- The group pick is gone: groups are shared shelves, and a book club's
-- planning lives in its group chat
ALTER TABLE "Group" DROP COLUMN "pickKey";
ALTER TABLE "Group" DROP COLUMN "pickTitle";
ALTER TABLE "Group" DROP COLUMN "pickAuthor";
ALTER TABLE "Group" DROP COLUMN "pickCover";
ALTER TABLE "Group" DROP COLUMN "pickedById";
ALTER TABLE "Group" DROP COLUMN "pickedAt";
ALTER TABLE "Group" DROP COLUMN "meetsAt";
