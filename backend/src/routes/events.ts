import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, requireRole, AuthRequest } from '../middleware/auth';
import { scoreFeed } from '../services/recommendation';
import { createTeamsMeeting, cancelTeamsMeeting } from '../services/calendarService';

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
      const userEmail = (user?.email as string)?.toLowerCase() ?? '';
      return targets.includes(user?.id) || targets.some((t) => t.toLowerCase() === userEmail);
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
      include: { location: true, organizer: { select: { name: true } }, _count: { select: { attendances: true } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    prisma.event.findMany({
      where: { ...baseWhere, audienceType: { not: 'ALL' } },
      include: { location: true, organizer: { select: { name: true } }, _count: { select: { attendances: true } } },
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

// Resolve audienceValue (mix of user IDs and email strings) to plain email addresses
async function resolveAttendeeEmails(audienceValue: string): Promise<string[]> {
  const raw: string[] = JSON.parse(audienceValue);
  const ids    = raw.filter((v) => !v.includes('@'));
  const emails = raw.filter((v) =>  v.includes('@')).map((e) => e.toLowerCase());
  if (ids.length > 0) {
    const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { email: true } });
    emails.push(...users.map((u) => u.email.toLowerCase()));
  }
  return [...new Set(emails)];
}

// Event erstellen (Organisator + Admin)
router.post('/', authenticate, requireRole('ORGANIZER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  const parsed = EventSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

  if (new Date(parsed.data.startDate) < new Date()) {
    return res.status(400).json({ message: 'Start date cannot be in the past' });
  }

  const event = await prisma.event.create({
    data: { ...parsed.data, organizerId: req.user!.id },
    include: { location: true },
  });

  // App → Teams: create meeting with invited attendees
  if (event.audienceType === 'SPECIFIC' && event.audienceValue) {
    resolveAttendeeEmails(event.audienceValue).then(async (emails) => {
      if (emails.length === 0) return;
      const msId = await createTeamsMeeting(req.user!.id, {
        id: event.id, title: event.title, description: event.description,
        startDate: event.startDate, endDate: event.endDate ?? null,
        location: event.location ? { name: event.location.name, city: event.location.city } : null,
      }, emails);
      if (msId) await prisma.event.update({ where: { id: event.id }, data: { msEventId: msId } });
    }).catch(console.error);
  }

  return res.status(201).json(event);
});

// Event bearbeiten
router.put('/:id', authenticate, requireRole('ORGANIZER', 'ADMIN'), async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const event = await prisma.event.findUnique({ where: { id }, include: { location: true } });
  if (!event) return res.status(404).json({ message: 'Event not found' });
  if (event.organizerId !== req.user!.id && req.user!.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const parsed = EventSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

  const updated = await prisma.event.update({ where: { id }, data: parsed.data, include: { location: true } });

  // Re-sync Teams meeting when audience or dates change
  const affectsTeams = parsed.data.audienceType !== undefined || parsed.data.audienceValue !== undefined
    || parsed.data.startDate !== undefined || parsed.data.endDate !== undefined
    || parsed.data.title !== undefined;

  if (affectsTeams) {
    (async () => {
      // Cancel old meeting if one exists
      if (event.msEventId && event.source !== 'TEAMS') {
        await cancelTeamsMeeting(event.organizerId, event.msEventId);
        await prisma.event.update({ where: { id }, data: { msEventId: null } });
      }
      // Create new meeting if still SPECIFIC
      const newType    = updated.audienceType;
      const newValue   = updated.audienceValue;
      if (newType === 'SPECIFIC' && newValue) {
        const emails = await resolveAttendeeEmails(newValue);
        if (emails.length > 0) {
          const msId = await createTeamsMeeting(event.organizerId, {
            id: updated.id, title: updated.title, description: updated.description,
            startDate: updated.startDate, endDate: updated.endDate ?? null,
            location: updated.location ? { name: updated.location.name, city: updated.location.city } : null,
          }, emails);
          if (msId) await prisma.event.update({ where: { id }, data: { msEventId: msId } });
        }
      }
    })().catch(console.error);
  }

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

  // Cancel the Teams meeting — sends cancellation to all attendees
  if (event.msEventId && event.source !== 'TEAMS') {
    cancelTeamsMeeting(event.organizerId, event.msEventId).catch(console.error);
  }

  return res.status(204).send();
});

export default router;
