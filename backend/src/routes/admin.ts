import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

// Nutzerliste
router.get('/users', authenticate, requireRole('ADMIN'), async (_req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    include: { location: true },
    orderBy: { name: 'asc' },
  });
  return res.json(users);
});

// Rolle ändern
router.put('/users/:id/role', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const RoleSchema = z.object({ role: z.enum(['USER', 'ORGANIZER', 'ADMIN']) });
  const parsed = RoleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

  const user = await prisma.user.update({
    where: { id: req.params.id as string },
    data: { role: parsed.data.role },
  });
  return res.json(user);
});

// Standorte abrufen (alle authentifizierten Nutzer, z.B. Onboarding)
router.get('/locations', authenticate, async (_req, res: Response) => {
  const locations = await prisma.location.findMany({ orderBy: { city: 'asc' } });
  return res.json(locations);
});

// Standort erstellen
router.post('/locations', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const LocationSchema = z.object({
    name: z.string().min(2),
    city: z.string().min(2),
    address: z.string().optional(),
  });
  const parsed = LocationSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

  const location = await prisma.location.create({ data: parsed.data });
  return res.status(201).json(location);
});

// Standort bearbeiten
router.put('/locations/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const location = await prisma.location.update({
    where: { id: req.params.id as string },
    data: req.body,
  });
  return res.json(location);
});

// Standort löschen
router.delete('/locations/:id', authenticate, requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  await prisma.location.delete({ where: { id: req.params.id as string } });
  return res.status(204).send();
});

// Systemstatistiken
router.get('/stats', authenticate, requireRole('ADMIN'), async (_req, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [totalUsers, activeEvents, totalEvents, swipesToday, totalAttendances] = await Promise.all([
    prisma.user.count(),
    prisma.event.count({ where: { status: 'ACTIVE' } }),
    prisma.event.count(),
    prisma.swipe.count({ where: { swipedAt: { gte: today } } }),
    prisma.attendance.count({ where: { status: 'CONFIRMED' } }),
  ]);
  return res.json({ totalUsers, activeEvents, totalEvents, swipesToday, totalAttendances });
});

// Alle Events (Admin-Übersicht)
router.get('/events', authenticate, requireRole('ADMIN'), async (_req, res: Response) => {
  const events = await prisma.event.findMany({
    include: { location: true, organizer: { select: { name: true } }, _count: { select: { attendances: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(events);
});

export default router;
