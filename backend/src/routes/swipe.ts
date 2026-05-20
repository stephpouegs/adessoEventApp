import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

const SwipeSchema = z.object({
  eventId: z.string().min(1),
  direction: z.enum(['RIGHT', 'LEFT']),
});

router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  const parsed = SwipeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

  const { eventId, direction } = parsed.data;
  const userId = req.user!.id;

  const swipe = await prisma.swipe.upsert({
    where: { userId_eventId: { userId, eventId } },
    update: { direction },
    create: { userId, eventId, direction },
  });

  let attendanceStatus: string | null = null;

  if (direction === 'RIGHT') {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    const attendanceCount = await prisma.attendance.count({ where: { eventId, status: 'CONFIRMED' } });
    attendanceStatus =
      event?.maxAttendees && attendanceCount >= event.maxAttendees ? 'WAITLIST' : 'CONFIRMED';

    await prisma.attendance.upsert({
      where: { userId_eventId: { userId, eventId } },
      update: { status: attendanceStatus },
      create: { userId, eventId, status: attendanceStatus },
    });
  } else {
    await prisma.attendance.deleteMany({ where: { userId, eventId } });
  }

  return res.status(201).json({ ...swipe, attendanceStatus });
});

router.delete('/:eventId', authenticate, async (req: AuthRequest, res: Response) => {
  const eventId = req.params.eventId as string;
  const userId = req.user!.id;

  await prisma.swipe.deleteMany({ where: { userId, eventId } });
  await prisma.attendance.deleteMany({ where: { userId, eventId } });

  return res.status(204).send();
});

router.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  const swipes = await prisma.swipe.findMany({
    where: { userId: req.user!.id },
    include: { event: { select: { title: true, type: true, startDate: true } } },
    orderBy: { swipedAt: 'desc' },
  });
  return res.json(swipes);
});

export default router;
