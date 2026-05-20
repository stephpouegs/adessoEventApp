import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface Event {
  id: string;
  type: string;
  locationId: string;
  startDate: Date;
  createdAt: Date;
  [key: string]: unknown;
}

export async function scoreFeed(userId: string, events: Event[]): Promise<Event[]> {
  const swipes = await prisma.swipe.findMany({ where: { userId } });

  if (swipes.length < 5) return events; // Kalt-Start: keine Personalisierung

  const rightSwipes = swipes.filter((s) => s.direction === 'RIGHT');

  // Top-3 bevorzugte Event-Typen
  const typeCounts: Record<string, number> = {};
  for (const s of rightSwipes) {
    const event = events.find((e) => e.id === s.eventId);
    if (event) typeCounts[event.type] = (typeCounts[event.type] ?? 0) + 1;
  }

  // Ablehnungsrate pro Typ
  const leftSwipes = swipes.filter((s) => s.direction === 'LEFT');
  const leftTypeCounts: Record<string, number> = {};
  for (const s of leftSwipes) {
    const event = events.find((e) => e.id === s.eventId);
    if (event) leftTypeCounts[event.type] = (leftTypeCounts[event.type] ?? 0) + 1;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const now = new Date();

  const scored = events.map((event) => {
    let score = 0;

    // Standort-Match
    if (user?.locationId && event.locationId === user.locationId) score += 3.0;

    // Bevorzugter Event-Typ
    const typeScore = typeCounts[event.type] ?? 0;
    score += Math.min(typeScore * 0.5, 2.0);

    // Häufig abgelehnt
    const leftScore = leftTypeCounts[event.type] ?? 0;
    score -= Math.min(leftScore * 0.5, 2.0);

    // Neues Event (< 24h)
    const ageHours = (now.getTime() - new Date(event.createdAt).getTime()) / 3_600_000;
    if (ageHours < 24) score += 1.0;

    // Bald (< 3 Tage)
    const daysUntil = (new Date(event.startDate).getTime() - now.getTime()) / 86_400_000;
    if (daysUntil < 3) score += 0.5;

    return { ...event, _score: score };
  });

  return scored.sort((a, b) => (b._score as number) - (a._score as number));
}
