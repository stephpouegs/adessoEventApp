-- AlterTable User: add businessLine and competenceCenter
ALTER TABLE "User" ADD COLUMN "businessLine" TEXT;
ALTER TABLE "User" ADD COLUMN "competenceCenter" TEXT;

-- AlterTable Event: add audienceType and audienceValue
ALTER TABLE "Event" ADD COLUMN "audienceType" TEXT NOT NULL DEFAULT 'ALL';
ALTER TABLE "Event" ADD COLUMN "audienceValue" TEXT;
