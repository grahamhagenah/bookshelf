-- AlterTable
ALTER TABLE "User" ADD COLUMN "friendInvite" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_friendInvite_key" ON "User"("friendInvite");

