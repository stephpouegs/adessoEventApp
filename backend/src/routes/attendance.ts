import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Meine Events (Swipe-Right)
router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  const attendances = await prisma.attendance.findMany({
    where: { userId: req.user!.id, status: { not: 'CANCELLED' } },
    include: {
      event: {
        include: { location: true, organizer: { select: { name: true } } },
      },
    },
    orderBy: { event: { startDate: 'asc' } },
  });
  return res.json(attendances);
});

// Abmelden von einem Event
router.delete('/:eventId', authenticate, async (req: AuthRequest, res: Response) => {
  const eventId = req.params.eventId as string;
  await prisma.attendance.deleteMany({
    where: { userId: req.user!.id, eventId },
  });
  await prisma.swipe.deleteMany({
    where: { userId: req.user!.id, eventId },
  });
  return res.status(204).send();
});

// Teilnehmerliste (Organisator)
router.get('/:eventId', authenticate, requireRole('ORGANIZER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  const eventId = req.params.eventId as string;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (event.organizerId !== req.user!.id && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const attendances = await prisma.attendance.findMany({
    where: { eventId },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { registeredAt: 'asc' },
  });
  return res.json(attendances);
});

export default router;
