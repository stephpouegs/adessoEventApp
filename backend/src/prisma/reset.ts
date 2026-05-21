import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🗑️  Lösche alle Daten...');
  await prisma.attendance.deleteMany();
  await prisma.swipe.deleteMany();
  await prisma.event.deleteMany();
  await prisma.user.deleteMany();
  await prisma.location.deleteMany();
  console.log('   ✅ Alle Tabellen geleert\n');

  console.log('📍 Erstelle Standorte...');
  await Promise.all([
    prisma.location.create({ data: { id: 'loc-dortmund', name: 'adesso Dortmund', city: 'Dortmund', address: 'Adessoplatz 1, 44269 Dortmund' } }),
    prisma.location.create({ data: { id: 'loc-berlin', name: 'adesso Berlin', city: 'Berlin', address: 'Unter den Linden 10, 10117 Berlin' } }),
    prisma.location.create({ data: { id: 'loc-hamburg', name: 'adesso Hamburg', city: 'Hamburg', address: 'Speicherstadt 5, 20457 Hamburg' } }),
    prisma.location.create({ data: { id: 'loc-muenchen', name: 'adesso München', city: 'München', address: 'Maximilianstraße 12, 80539 München' } }),
    prisma.location.create({ data: { id: 'loc-frankfurt', name: 'adesso Frankfurt', city: 'Frankfurt', address: 'Mainzer Landstraße 50, 60325 Frankfurt' } }),
    prisma.location.create({ data: { id: 'loc-koeln', name: 'adesso Köln', city: 'Köln', address: 'Augustinerstraße 1, 50667 Köln' } }),
    prisma.location.create({ data: { id: 'loc-muenster', name: 'adesso Münster', city: 'Münster', address: 'Hafenweg 24, 48155 Münster' } }),
  ]);
  console.log('   ✅ 7 Standorte\n');

  console.log('👤 Erstelle Nutzer...');
  await prisma.user.create({ data: { id: 'user-admin', email: 'admin@adesso.de', name: 'Admin adesso', role: 'ADMIN', locationId: 'loc-dortmund' } });
  await prisma.user.create({ data: { id: 'user-organizer', email: 'organizer@adesso.de', name: 'Sarah Müller', role: 'ORGANIZER', locationId: 'loc-dortmund' } });
  await prisma.user.create({ data: { id: 'user-demo', email: 'demo@adesso.de', name: 'Demo User', role: 'USER', locationId: 'loc-dortmund' } });
  console.log('   ✅ 3 Nutzer (admin, organizer, demo)\n');

  console.log('📅 Erstelle Events...');
  const now = new Date();
  const d = (days: number, hour = 17) => { const dt = new Date(now); dt.setDate(dt.getDate() + days); dt.setHours(hour, 0, 0, 0); return dt; };

  const events = [
    { id: 'evt-1', title: 'Tischtennis Turnier', description: 'Unser monatliches Tischtennis-Turnier! Jeder kann mitmachen — Anfänger wie Profis.', type: 'SPORT', locationId: 'loc-dortmund', startDate: d(3, 17), endDate: d(3, 20), maxAttendees: 16 },
    { id: 'evt-2', title: 'React & TypeScript Workshop', description: 'Ganztägiger Workshop zu modernen React-Patterns: Hooks, Context, Suspense und TypeScript Best Practices.', type: 'TRAINING', locationId: 'loc-dortmund', startDate: d(5, 9), endDate: d(5, 17), maxAttendees: 20 },
    { id: 'evt-3', title: 'Sommerfest adesso 2026', description: 'Das große adesso Sommerfest! BBQ, Musik, Spiele und gute Gesellschaft.', type: 'COMPANY', locationId: 'loc-dortmund', startDate: d(14, 15), endDate: d(14, 23), maxAttendees: null },
    { id: 'evt-4', title: 'KI & Machine Learning Meetup', description: 'Monatliches Meetup der AI-Community. Diesen Monat: Large Language Models in der Praxis.', type: 'MEETING', locationId: 'loc-dortmund', startDate: d(7, 18), endDate: d(7, 21), maxAttendees: 50 },
    { id: 'evt-5', title: 'Yoga & Meditation Session', description: 'Wöchentliche Yoga-Session für alle Level. 45 Min. Yoga, danach 15 Min. Meditation.', type: 'LEISURE', locationId: 'loc-dortmund', startDate: d(2, 12), endDate: d(2, 13), maxAttendees: 12 },
    { id: 'evt-6', title: 'Stadtlauf Team Dortmund', description: 'Gemeinsam beim Dortmunder Stadtlauf antreten! 5km oder 10km — jeder sucht sich seine Distanz.', type: 'SPORT', locationId: 'loc-dortmund', startDate: d(21, 10), endDate: d(21, 13), maxAttendees: 30 },
    { id: 'evt-7', title: 'Agile Coaches Community', description: 'Erfahrungsaustausch für Scrum Masters und Product Owner. Thema: Skalierung agiler Teams.', type: 'MEETING', locationId: 'loc-berlin', startDate: d(4, 14), endDate: d(4, 17), maxAttendees: 25 },
    { id: 'evt-8', title: 'Hamburger Hafenrundfahrt', description: 'Teambuilding auf dem Wasser! 2-stündige Hafenrundfahrt mit Guide, danach Fischbrötchen.', type: 'LEISURE', locationId: 'loc-hamburg', startDate: d(10, 14), endDate: d(10, 18), maxAttendees: 20 },
    { id: 'evt-9', title: 'Cloud Architecture Deep Dive', description: 'Zwei Tage intensives Training zu AWS und Azure Architektur-Patterns mit Hands-on Labs.', type: 'TRAINING', locationId: 'loc-muenchen', startDate: d(8, 9), endDate: d(9, 17), maxAttendees: 15 },
    { id: 'evt-10', title: 'Weihnachtsfeier Frankfurt', description: 'Die Weihnachtsfeier des Frankfurter Teams! Festliches Dinner, Tombola und Musik.', type: 'COMPANY', locationId: 'loc-frankfurt', startDate: d(45, 19), endDate: d(45, 23), maxAttendees: 80 },
    { id: 'evt-11', title: 'Kicker-Turnier Köln', description: 'Unser Kicker-Turnier im Kölner Büro! Teams aus je 2 Personen.', type: 'SPORT', locationId: 'loc-koeln', startDate: d(6, 16), endDate: d(6, 19), maxAttendees: 24 },
    { id: 'evt-12', title: 'Design Thinking Workshop', description: 'Lerne die Design Thinking Methode kennen, moderiert von unserem Innovation Lab.', type: 'TRAINING', locationId: 'loc-dortmund', startDate: d(12, 9), endDate: d(12, 17), maxAttendees: 18 },
    { id: 'evt-13', title: 'Lauftruppe Münster', description: 'Gemeinsam durch Münsters schöne Altstadt und den Aasee laufen! Offen für alle Fitness-Level, Tempo wird angepasst.', type: 'SPORT', locationId: 'loc-muenster', startDate: d(2, 7), endDate: d(2, 8), maxAttendees: 20 },
    { id: 'evt-14', title: 'Fitnessraum Session', description: 'Nutzung des Fitnessraums im Münsteraner Büro. Gemeinsames Training mit optionaler Anleitung durch erfahrene Kollegen.', type: 'SPORT', locationId: 'loc-muenster', startDate: d(4, 7), endDate: d(4, 8), maxAttendees: 10 },
    { id: 'evt-15', title: 'Mitarbeiterfrühstück Münster', description: 'Gemeinsames Frühstück im Büro Münster! Brötchen, Aufschnitt und gute Gespräche — perfekter Start in den Tag.', type: 'COMPANY', locationId: 'loc-muenster', startDate: d(5, 8), endDate: d(5, 10), maxAttendees: 30 },
    { id: 'evt-16', title: 'Gaming Abend Münster', description: 'Entspannter Gaming-Abend mit Konsolen, Brett- und Kartenspielen. Bring dein Lieblingsspiel mit!', type: 'LEISURE', locationId: 'loc-muenster', startDate: d(8, 18), endDate: d(8, 22), maxAttendees: 15 },
  ];

  for (const evt of events) {
    await prisma.event.create({ data: { ...evt, organizerId: 'user-organizer', status: 'ACTIVE' } });
  }
  console.log(`   ✅ ${events.length} Events (inkl. 4 Münster)\n`);

  console.log('✅ Reset abgeschlossen!\n');
  console.log('─────────────────────────────────');
  console.log('🔑 Login-Accounts:');
  console.log('   demo@adesso.de      → Nutzer');
  console.log('   organizer@adesso.de → Organisator');
  console.log('   admin@adesso.de     → Admin');
  console.log('─────────────────────────────────');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
