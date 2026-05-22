import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const cols = [
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "msAccessToken" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "msRefreshToken" TEXT`,
    `ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "msTokenExpiry" TIMESTAMP(3)`,
    `ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "calendarEventId" TEXT`,
  ];

  for (const sql of cols) {
    await prisma.$executeRawUnsafe(sql);
    console.log('OK:', sql.split(' ').slice(0, 6).join(' '));
  }
  console.log('Migration 20260522000000_ms_calendar applied.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
