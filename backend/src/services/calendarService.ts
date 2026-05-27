import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MS_TOKEN_URL = `https://login.microsoftonline.com/${process.env.MS_TENANT_ID}/oauth2/v2.0/token`;
const GRAPH_EVENTS_URL = 'https://graph.microsoft.com/v1.0/me/events';
const GRAPH_SUBSCRIPTIONS_URL = 'https://graph.microsoft.com/v1.0/subscriptions';

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

// Register a Graph change-notification subscription for the organizer's calendar.
// Called once after the organizer completes the MS OAuth flow.
export async function subscribeToCalendar(userId: string): Promise<void> {
  const notificationUrl = process.env.BACKEND_URL
    ? `${process.env.BACKEND_URL}/api/microsoft/webhook`
    : null;

  if (!notificationUrl) return; // local dev without public URL — skip

  const token = await getValidToken(userId);
  if (!token) return;

  // Max expiry for calendar subscriptions is 4230 minutes (~3 days)
  const expirationDateTime = new Date(Date.now() + 4230 * 60 * 1000).toISOString();

  try {
    const resp = await fetch(GRAPH_SUBSCRIPTIONS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        changeType: 'created,updated',
        notificationUrl,
        resource: '/me/events',
        expirationDateTime,
        clientState: userId,
      }),
    });

    if (!resp.ok) {
      console.error('Graph subscription failed:', await resp.text());
      return;
    }

    const data = (await resp.json()) as any;
    await prisma.user.update({ where: { id: userId }, data: { msSubscriptionId: data.id } });
  } catch (err) {
    console.error('subscribeToCalendar error:', err);
  }
}

// Renew a subscription before it expires (called proactively from /status route).
export async function renewSubscription(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { msSubscriptionId: true },
  });
  if (!user?.msSubscriptionId) return;

  const token = await getValidToken(userId);
  if (!token) return;

  const expirationDateTime = new Date(Date.now() + 4230 * 60 * 1000).toISOString();

  try {
    await fetch(`${GRAPH_SUBSCRIPTIONS_URL}/${user.msSubscriptionId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expirationDateTime }),
    });
  } catch {
    // best-effort
  }
}

// Called by the webhook handler: fetch the full Graph event and create an adesso event.
export async function importTeamsEvent(subscriptionId: string, msEventId: string): Promise<void> {
  const organizer = await prisma.user.findFirst({
    where: { msSubscriptionId: subscriptionId },
    include: { location: true },
  });
  if (!organizer) return;

  const token = await getValidToken(organizer.id);
  if (!token) return;

  // Deduplicate
  const existing = await prisma.event.findFirst({ where: { msEventId } });
  if (existing) return;

  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/me/events/${msEventId}` +
    `?$select=subject,body,start,end,location,attendees,isCancelled`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!resp.ok) return;

  const msEvent = (await resp.json()) as any;

  // Skip our own outbound events to avoid duplicates
  if ((msEvent.subject as string)?.startsWith('[adesso]')) return;
  if (msEvent.isCancelled) return;

  // Attendee emails → audienceValue (used by existing SPECIFIC filter)
  const attendeeEmails: string[] = (msEvent.attendees ?? [])
    .map((a: any) => (a.emailAddress?.address as string)?.toLowerCase())
    .filter(Boolean);

  const locationId = organizer.locationId
    ?? (await prisma.location.findFirst({ where: { active: true } }))!.id;

  // Parse dates (Graph returns local time with timeZone annotation)
  const toDate = (dt: string, tz: string) =>
    new Date(tz === 'UTC' ? dt + 'Z' : dt);

  const startDate = toDate(msEvent.start.dateTime, msEvent.start.timeZone);
  const endDate   = msEvent.end?.dateTime
    ? toDate(msEvent.end.dateTime, msEvent.end.timeZone)
    : null;

  // Strip HTML from body
  const rawBody: string = msEvent.body?.content ?? '';
  const description = rawBody.replace(/<[^>]*>/g, '').trim().slice(0, 500)
    || (msEvent.subject as string);

  await prisma.event.create({
    data: {
      title: (msEvent.subject as string) ?? 'Teams-Event',
      description,
      type: 'MEETING',
      locationId,
      organizerId: organizer.id,
      startDate,
      endDate,
      source: 'TEAMS',
      msEventId,
      audienceType: 'SPECIFIC',
      audienceValue: JSON.stringify(attendeeEmails),
      status: 'ACTIVE',
    },
  });
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
