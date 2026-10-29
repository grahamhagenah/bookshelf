-- A group's description, and whether its page has the planning card
ALTER TABLE "Group" ADD COLUMN "description" TEXT;
ALTER TABLE "Group" ADD COLUMN "planning" BOOLEAN NOT NULL DEFAULT true;
