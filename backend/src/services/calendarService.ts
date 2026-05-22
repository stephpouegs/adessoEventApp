import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MS_TOKEN_URL = `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`;
const GRAPH_EVENTS_URL = 'https://graph.microsoft.com/v1.0/me/events';

interface EventData {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date | null;
  location?: { name: string; city: string } | null;
}

async function getValidToken(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { msAccessToken: true, msRefreshToken: true, msTokenExpiry: true },
  });

  if (!user?.msAccessToken) return null;

  // Token still valid (5 min buffer)
  if (user.msTokenExpiry && user.msTokenExpiry > new Date(Date.now() + 5 * 60 * 1000)) {
    return user.msAccessToken;
  }

  if (!user.msRefreshToken) return null;

  // Refresh the token
  try {
    const params = new URLSearchParams({
      client_id: process.env.MS_CLIENT_ID!,
      client_secret: process.env.MS_CLIENT_SECRET!,
      refresh_token: user.msRefreshToken,
      grant_type: 'refresh_token',
      scope: 'Calendars.ReadWrite offline_access',
    });

    const resp = await fetch(MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!resp.ok) return null;

    const data = (await resp.json()) as any;

    await prisma.user.update({
      where: { id: userId },
      data: {
        msAccessToken: data.access_token,
        msRefreshToken: data.refresh_token ?? user.msRefreshToken,
        msTokenExpiry: new Date(Date.now() + data.expires_in * 1000),
      },
    });

    return data.access_token as string;
  } catch {
    return null;
  }
}

export async function addToCalendar(userId: string, event: EventData): Promise<string | null> {
  const token = await getValidToken(userId);
  if (!token) return null;

  const locationName = event.location
    ? `${event.location.name} – ${event.location.city}`
    : 'adesso';

  // Default end = 1 hour after start if not set
  const endDate = event.endDate ?? new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000);

  const body = {
    subject: `[adesso] ${event.title}`,
    body: { contentType: 'text', content: event.description },
    start: { dateTime: new Date(event.startDate).toISOString(), timeZone: 'Europe/Berlin' },
    end: { dateTime: new Date(endDate).toISOString(), timeZone: 'Europe/Berlin' },
    location: { displayName: locationName },
    categories: ['adesso Event'],
  };

  try {
    const resp = await fetch(GRAPH_EVENTS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!resp.ok) return null;
    const created = (await resp.json()) as any;
    return created.id as string;
  } catch {
    return null;
  }
}

export async function removeFromCalendar(userId: string, calendarEventId: string): Promise<void> {
  const token = await getValidToken(userId);
  if (!token) return;

  try {
    await fetch(`${GRAPH_EVENTS_URL}/${calendarEventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Calendar sync is best-effort — don't fail the swipe action
  }
}
