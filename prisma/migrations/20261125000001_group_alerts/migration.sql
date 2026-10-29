-- Which of a group's goings-on reach each member's alerts
ALTER TABLE "GroupMember" ADD COLUMN "alertPicks" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GroupMember" ADD COLUMN "alertMeetups" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "GroupMember" ADD COLUMN "alertJoins" BOOLEAN NOT NULL DEFAULT true;
