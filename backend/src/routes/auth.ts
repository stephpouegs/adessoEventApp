import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// SSO callback — in production, validate the token with the OIDC provider
router.post('/callback', async (req: Request, res: Response) => {
  const { email, name } = req.body;

  if (!email?.endsWith('@adesso.de')) {
    return res.status(403).json({ message: 'Only adesso email addresses are allowed' });
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { email, name: name || email.split('@')[0] } });
  }

  const accessToken = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET!,
    { expiresIn: '8h' }
  );

  return res.json({ accessToken, user: { id: user.id, email: user.email, name: user.name, role: user.role, locationId: user.locationId } });
});

router.get('/me', async (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };
    const user = await prisma.user.findUnique({ where: { id: payload.id }, include: { location: true } });
    return res.json(user);
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
});

export default router;
