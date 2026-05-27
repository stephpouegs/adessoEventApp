import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { authenticate, AuthRequest } from '../middleware/auth';
import { subscribeToCalendar, renewSubscription, importTeamsEvent } from '../services/calendarService';

const router = Router();
const prisma = new PrismaClient();

const MS_AUTH_BASE = `https://login.microsoftonline.com/${process.env.MS_TENANT_ID ?? 'common'}/oauth2/v2.0`;
const SCOPES = 'Calendars.ReadWrite offline_access User.Read';

// Redirect user to Microsoft OAuth consent screen
// The JWT is passed as query param so it survives the redirect
router.get('/connect', (req: Request, res: Response) => {
  const token = (req.query.token as string) || req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID!,
    response_type: 'code',
    redirect_uri: process.env.MS_REDIRECT_URI!,
    scope: SCOPES,
    state: token,
    response_mode: 'query',
  });

  return res.redirect(`${MS_AUTH_BASE}/authorize?${params.toString()}`);
});

// OAuth callback — exchange code for access + refresh tokens
router.get('/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query as Record<string, string>;

  if (error) {
    return res.redirect(`${process.env.FRONTEND_URL}/profile?ms_error=${encodeURIComponent(error)}`);
  }

  if (!code || !state) {
    return res.status(400).send('Missing code or state');
  }

  // Identify user from JWT state
  let userId: string;
  try {
    const payload = jwt.verify(state, process.env.JWT_SECRET!) as { id: string };
    userId = payload.id;
  } catch {
    return res.status(401).send('Invalid state token');
  }

  const params = new URLSearchParams({
    client_id: process.env.MS_CLIENT_ID!,
    client_secret: process.env.MS_CLIENT_SECRET!,
    code,
    redirect_uri: process.env.MS_REDIRECT_URI!,
    grant_type: 'authorization_code',
  });

  try {
    const resp = await fetch(`${MS_AUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!resp.ok) {
      console.error('MS token exchange failed:', await resp.text());
      return res.redirect(`${process.env.FRONTEND_URL}/profile?ms_error=token_exchange_failed`);
    }

    const data = (await resp.json()) as any;

    await prisma.user.update({
      where: { id: userId },
      data: {
        msAccessToken: data.access_token,
        msRefreshToken: data.refresh_token,
        msTokenExpiry: new Date(Date.now() + data.expires_in * 1000),
      },
    });

    // Register webhook subscription so Teams events flow into the feed
    subscribeToCalendar(userId).catch(console.error);

    return res.redirect(`${process.env.FRONTEND_URL}/profile?ms_connected=true`);
  } catch (err) {
    console.error('MS OAuth error:', err);
    return res.redirect(`${process.env.FRONTEND_URL}/profile?ms_error=server_error`);
  }
});

// Check connection status + opportunistically renew subscription
router.get('/status', authenticate, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { msAccessToken: true, msTokenExpiry: true, msSubscriptionId: true },
  });

  const connected = !!user?.msAccessToken;
  const expired = connected && user?.msTokenExpiry ? user.msTokenExpiry < new Date() : false;

  // Renew subscription in background if connected
  if (connected && user?.msSubscriptionId) {
    renewSubscription(req.user!.id).catch(console.error);
  }

  return res.json({ connected, expired });
});

// Disconnect Microsoft account
router.delete('/disconnect', authenticate, async (req: AuthRequest, res: Response) => {
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { msAccessToken: null, msRefreshToken: null, msTokenExpiry: null, msSubscriptionId: null },
  });
  return res.json({ message: 'Microsoft account disconnected' });
});

// Graph webhook validation (GET with validationToken query param)
router.get('/webhook', (req: Request, res: Response) => {
  const validationToken = req.query.validationToken as string | undefined;
  if (validationToken) {
    return res.status(200).contentType('text/plain').send(validationToken);
  }
  return res.sendStatus(400);
});

// Graph webhook notifications (POST — must respond 202 immediately)
router.post('/webhook', (req: Request, res: Response) => {
  res.sendStatus(202); // acknowledge before any async work

  const notifications: any[] = req.body?.value ?? [];
  for (const n of notifications) {
    const { subscriptionId, changeType, resourceData } = n;
    if ((changeType === 'created' || changeType === 'updated') && resourceData?.id) {
      importTeamsEvent(subscriptionId, resourceData.id as string).catch(console.error);
    }
  }
});

export default router;
