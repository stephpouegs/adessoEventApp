import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { scoreFeed } from '../services/recommendation';

const router = Router();
const prisma = new PrismaClient();

const EventSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  type: z.enum(['SPORT', 'MEETING', 'LEISURE', 'TRAINING', 'COMPANY', 'OTHER']),
  locationId: z.string().min(1),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  maxAttendees: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

// Personalisierter Feed
router.get('/feed', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  const alreadySwiped = await prisma.swipe.findMany({
    where: { userId },
    select: { eventId: true },
  });
  const swipedIds = alreadySwiped.map((s) => s.eventId);

  const baseWhere = {
    status: 'ACTIVE',
    startDate: { gte: new Date() },
    id: { notIn: swipedIds },
  };

  // Explizit gewählter Standort (Query-Param) hat Vorrang; dann Nutzer-Standort; sonst alle
  const filterLocationId = (req.query.locationId as string) || null;
  const effectiveLocationId = filterLocationId === 'all' ? null : (filterLocationId ?? user?.locationId ?? null);

  let events = await prisma.event.findMany({
    where: { ...baseWhere, ...(effectiveLocationId ? { locationId: effectiveLocationId } : {}) },
    include: { location: true, organizer: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // Fallback: wenn gefilterter Feed leer und kein expliziter Filter → alle Standorte
  if (events.length === 0 && !filterLocationId) {
    events = await prisma.event.findMany({
      where: baseWhere,
      include: { location: true, organizer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  const scored = await scoreFeed(userId, events as any);
  return res.json(scored);
});

// Eigene Events des Organisators
router.get('/my', authenticate, async (req: AuthRequest, res: Response) => {
  const events = await prisma.event.findMany({
    where: { organizerId: req.user!.id },
    include: { location: true, _count: { select: { attendances: true } } },
    orderBy: { startDate: 'asc' },
  });
  return res.json(events);
});

// Event-Details
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const event = await prisma.event.findUnique({
    where: { id: req.params.id },
    include: {
      location: true,
      organizer: { select: { name: true, email: true } },
      _count: { select: { attendances: true } },
    },
  });
  if (!event) return res.status(404).json({ message: 'Event not found' });
  return res.json(event);
});

// Event erstellen (Organisator)
router.post('/', authenticate, requireRole('ORGANIZER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  const parsed = EventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

  if (new Date(parsed.data.startDate) < new Date()) {
    return res.status(400).json({ message: 'Start date cannot be in the past' });
  }

  const event = await prisma.event.create({
    data: { ...parsed.data, organizerId: req.user!.id },
  });
  return res.status(201).json(event);
});

// Event bearbeiten
router.put('/:id', authenticate, requireRole('ORGANIZER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (event.organizerId !== req.user!.id && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const parsed = EventSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

  const updated = await prisma.event.update({ where: { id: req.params.id }, data: parsed.data });
  return res.json(updated);
});

// Event absagen (Admin oder Organisator)
router.delete('/:id', authenticate, requireRole('ORGANIZER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  const event = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (event.organizerId !== req.user!.id && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  await prisma.event.update({ where: { id: req.params.id }, data: { status: 'CANCELLED' } });
  return res.status(204).send();
});

export default router;
