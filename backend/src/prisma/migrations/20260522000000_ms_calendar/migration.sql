-- AlterTable User: add Microsoft OAuth token fields
ALTER TABLE "User" ADD COLUMN "msAccessToken" TEXT;
ALTER TABLE "User" ADD COLUMN "msRefreshToken" TEXT;
ALTER TABLE "User" ADD COLUMN "msTokenExpiry" TIMESTAMP(3);

-- AlterTable Attendance: add Outlook calendar event ID
ALTER TABLE "Attendance" ADD COLUMN "calendarEventId" TEXT;
