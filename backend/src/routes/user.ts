import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

router.put('/location', authenticate, async (req: AuthRequest, res: Response) => {
  const schema = z.object({ locationId: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { locationId: parsed.data.locationId },
  });
  return res.json(user);
});

router.put('/settings', authenticate, async (req: AuthRequest, res: Response) => {
  const schema = z.object({
    language: z.enum(['DE', 'EN']).optional(),
    aiOptIn: z.boolean().optional(),
    locationId: z.string().min(1).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ errors: parsed.error.flatten() });

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: parsed.data,
    include: { location: true },
  });
  return res.json(user);
});

export default router;
