-- AlterTable
ALTER TABLE "User" ADD COLUMN "planEndsAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "planRenewsAt" DATETIME;
ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "User" ADD COLUMN "stripeSubscriptionId" TEXT;
ALTER TABLE "User" ADD COLUMN "subscriptionStatus" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");

