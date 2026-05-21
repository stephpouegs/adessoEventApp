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
  audienceType: z.enum(['ALL', 'LOCATION', 'BUSINESS_LINE', 'CC', 'SPECIFIC']).default('ALL'),
  audienceValue: z.string().optional(),
});

function isVisibleToUser(event: any, user: any): boolean {
  switch (event.audienceType) {
    case 'ALL': return true;
    case 'LOCATION': {
      if (!event.audienceValue) return true;
      const locs: string[] = JSON.parse(event.audienceValue);
      return locs.includes(user?.locationId ?? '');
    }
    case 'BUSINESS_LINE':
      return !!user?.businessLine && user.businessLine === event.audienceValue;
    case 'CC':
      return !!user?.competenceCenter && user.competenceCenter === event.audienceValue;
    case 'SPECIFIC': {
      if (!event.audienceValue) return false;
      const targets: string[] = JSON.parse(event.audienceValue);
      return targets.includes(user?.id) || targets.includes(user?.email);
    }
    default: return true;
  }
}

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

  const filterLocationId = (req.query.locationId as string) || null;
  const effectiveLocationId = filterLocationId === 'all' ? null : (filterLocationId ?? user?.locationId ?? null);

  // Fetch ALL-type events (location-filtered) + audience-targeted events separately
  const [locationEvents, targetedEvents] = await Promise.all([
    prisma.event.findMany({
      where: {
        ...baseWhere,
        audienceType: 'ALL',
        ...(effectiveLocationId ? { locationId: effectiveLocationId } : {}),
      },
      include: { location: true, organizer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.event.findMany({
      where: { ...baseWhere, audienceType: { not: 'ALL' } },
      include: { location: true, organizer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  // Filter targeted events by user's profile
  const visibleTargeted = targetedEvents.filter((e) => isVisibleToUser(e, user));

  // Merge, deduplicate, cap at 20
  const seen = new Set<string>();
  const merged: typeof locationEvents = [];
  for (const e of [...visibleTargeted, ...locationEvents]) {
    if (!seen.has(e.id)) { seen.add(e.id); merged.push(e); }
    if (merged.length >= 20) break;
  }

  // Fallback: if still empty, show all ALL-type events regardless of location
  if (merged.length === 0 && !filterLocationId) {
    const fallback = await prisma.event.findMany({
      where: { ...baseWhere, audienceType: 'ALL' },
      include: { location: true, organizer: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const scored = await scoreFeed(userId, fallback as any);
    return res.json(scored);
  }

  const scored = await scoreFeed(userId, merged as any);
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

// Alle Events für Admin (Moderation, kein Feed-Filter)
router.get('/admin/all', authenticate, requireRole('ADMIN'), async (_req: AuthRequest, res: Response) => {
  const events = await prisma.event.findMany({
    include: { location: true, organizer: { select: { name: true } }, _count: { select: { attendances: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(events);
});

// Event-Details
router.get('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const event = await prisma.event.findUnique({
    where: { id },
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
  const id = req.params.id as string;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (event.organizerId !== req.user!.id && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const parsed = EventSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

  const updated = await prisma.event.update({ where: { id }, data: parsed.data });
  return res.json(updated);
});

// Event absagen
router.delete('/:id', authenticate, requireRole('ORGANIZER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (event.organizerId !== req.user!.id && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  await prisma.event.update({ where: { id }, data: { status: 'CANCELLED' } });
  return res.status(204).send();
});

export default router;
