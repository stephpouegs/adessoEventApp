import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import 'dotenv/config';

import { PrismaClient } from '@prisma/client';
import { authenticate, requireRole } from './middleware/auth';
import type { AuthRequest } from './middleware/auth';
import type { Response } from 'express';
import authRoutes from './routes/auth';
import eventsRoutes from './routes/events';
import swipeRoutes from './routes/swipe';
import attendanceRoutes from './routes/attendance';
import adminRoutes from './routes/admin';
import userRoutes from './routes/user';
import microsoftRoutes from './routes/microsoft';

const prisma = new PrismaClient();

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: true }));

app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/swipe', swipeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/microsoft', microsoftRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/api/admin/stats', authenticate, requireRole('ADMIN'), async (_req: AuthRequest, res: Response) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [totalUsers, activeEvents, totalEvents, swipesToday, totalAttendances] = await Promise.all([
    prisma.user.count(),
    prisma.event.count({ where: { status: 'ACTIVE' } }),
    prisma.event.count(),
    prisma.swipe.count({ where: { swipedAt: { gte: today } } }),
    prisma.attendance.count({ where: { status: 'CONFIRMED' } }),
  ]);
  res.json({ totalUsers, activeEvents, totalEvents, swipesToday, totalAttendances });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));

export default app;
