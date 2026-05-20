import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // ─── Standorte ────────────────────────────────────────────────
  console.log('📍 Erstelle Standorte...');
  const locations = await Promise.all([
    prisma.location.upsert({ where: { id: 'loc-dortmund' }, update: {}, create: { id: 'loc-dortmund', name: 'adesso Dortmund', city: 'Dortmund', address: 'Adessoplatz 1, 44269 Dortmund', active: true } }),
    prisma.location.upsert({ where: { id: 'loc-berlin' }, update: {}, create: { id: 'loc-berlin', name: 'adesso Berlin', city: 'Berlin', address: 'Unter den Linden 10, 10117 Berlin', active: true } }),
    prisma.location.upsert({ where: { id: 'loc-hamburg' }, update: {}, create: { id: 'loc-hamburg', name: 'adesso Hamburg', city: 'Hamburg', address: 'Speicherstadt 5, 20457 Hamburg', active: true } }),
    prisma.location.upsert({ where: { id: 'loc-muenchen' }, update: {}, create: { id: 'loc-muenchen', name: 'adesso München', city: 'München', address: 'Maximilianstraße 12, 80539 München', active: true } }),
    prisma.location.upsert({ where: { id: 'loc-frankfurt' }, update: {}, create: { id: 'loc-frankfurt', name: 'adesso Frankfurt', city: 'Frankfurt', address: 'Mainzer Landstraße 50, 60325 Frankfurt', active: true } }),
    prisma.location.upsert({ where: { id: 'loc-koeln' }, update: {}, create: { id: 'loc-koeln', name: 'adesso Köln', city: 'Köln', address: 'Augustinerstraße 1, 50667 Köln', active: true } }),
  ]);
  console.log(`   ✅ ${locations.length} Standorte erstellt\n`);

  // ─── Nutzer ───────────────────────────────────────────────────
  console.log('👤 Erstelle Nutzer...');
  const admin = await prisma.user.upsert({
    where: { email: 'admin@adesso.de' },
    update: {},
    create: { id: 'user-admin', email: 'admin@adesso.de', name: 'Admin adesso', role: 'ADMIN', locationId: 'loc-dortmund', aiOptIn: true },
  });
  const organizer = await prisma.user.upsert({
    where: { email: 'organizer@adesso.de' },
    update: {},
    create: { id: 'user-organizer', email: 'organizer@adesso.de', name: 'Sarah Müller', role: 'ORGANIZER', locationId: 'loc-dortmund', aiOptIn: true },
  });
  const demo = await prisma.user.upsert({
    where: { email: 'demo@adesso.de' },
    update: {},
    create: { id: 'user-demo', email: 'demo@adesso.de', name: 'Demo User', role: 'USER', locationId: 'loc-dortmund', aiOptIn: true },
  });
  await prisma.user.upsert({
    where: { email: 'max.mustermann@adesso.de' },
    update: {},
    create: { id: 'user-max', email: 'max.mustermann@adesso.de', name: 'Max Mustermann', role: 'USER', locationId: 'loc-berlin', aiOptIn: true },
  });
  await prisma.user.upsert({
    where: { email: 'anna.schmidt@adesso.de' },
    update: {},
    create: { id: 'user-anna', email: 'anna.schmidt@adesso.de', name: 'Anna Schmidt', role: 'USER', locationId: 'loc-hamburg', aiOptIn: true },
  });
  console.log('   ✅ 5 Nutzer erstellt (admin, organizer, demo, max, anna)\n');

  // ─── Events ───────────────────────────────────────────────────
  console.log('📅 Erstelle Events...');

  const now = new Date();
  const d = (days: number, hour = 17) => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    date.setHours(hour, 0, 0, 0);
    return date;
  };

  const events = [
    {
      id: 'evt-1', title: 'Tischtennis Turnier', description: 'Unser monatliches Tischtennis-Turnier! Jeder kann mitmachen — Anfänger wie Profis. Wir spielen in der KO-Runde. Eigenen Schläger gerne mitbringen, aber nicht Pflicht.',
      type: 'SPORT', locationId: 'loc-dortmund', startDate: d(3, 17), endDate: d(3, 20), maxAttendees: 16, notes: 'Sportkleidung empfohlen',
    },
    {
      id: 'evt-2', title: 'React & TypeScript Workshop', description: 'Ganztägiger Workshop zu modernen React-Patterns: Hooks, Context, Suspense und TypeScript Best Practices. Für Entwickler mit ersten React-Kenntnissen.',
      type: 'TRAINING', locationId: 'loc-dortmund', startDate: d(5, 9), endDate: d(5, 17), maxAttendees: 20, notes: 'Laptop mitbringen, Node.js vorinstalliert',
    },
    {
      id: 'evt-3', title: 'Sommerfest adesso 2026', description: 'Das große adesso Sommerfest! BBQ, Musik, Spiele und gute Gesellschaft. Familien und Freunde sind herzlich willkommen. Für Essen und Getränke ist gesorgt.',
      type: 'COMPANY', locationId: 'loc-dortmund', startDate: d(14, 15), endDate: d(14, 23), maxAttendees: null, notes: 'Familien willkommen',
    },
    {
      id: 'evt-4', title: 'KI & Machine Learning Meetup', description: 'Monatliches Meetup der AI-Community bei adesso. Diesen Monat: Large Language Models in der Praxis und Demos unserer internen KI-Projekte. Anschließend Networking.',
      type: 'MEETING', locationId: 'loc-dortmund', startDate: d(7, 18), endDate: d(7, 21), maxAttendees: 50, notes: 'Anmeldung erforderlich',
    },
    {
      id: 'evt-5', title: 'Yoga & Meditation Session', description: 'Wöchentliche Yoga-Session für alle Level. 45 Minuten Yoga, danach 15 Minuten Meditation. Perfekt zum Abschalten nach einem langen Arbeitstag.',
      type: 'LEISURE', locationId: 'loc-dortmund', startDate: d(2, 12), endDate: d(2, 13), maxAttendees: 12, notes: 'Yogamatte mitbringen oder bei Sarah ausleihen',
    },
    {
      id: 'evt-6', title: 'Stadtlauf Team Dortmund', description: 'Gemeinsam beim Dortmunder Stadtlauf antreten! 5km oder 10km — jeder sucht sich seine Distanz aus. T-Shirts mit adesso-Logo werden gestellt.',
      type: 'SPORT', locationId: 'loc-dortmund', startDate: d(21, 10), endDate: d(21, 13), maxAttendees: 30, notes: 'Anmeldung bis 3 Tage vorher',
    },
    {
      id: 'evt-7', title: 'Agile Coaches Community', description: 'Erfahrungsaustausch für Scrum Masters, Product Owner und Agile Coaches. Thema diesmal: Skalierung agiler Teams in Großprojekten.',
      type: 'MEETING', locationId: 'loc-berlin', startDate: d(4, 14), endDate: d(4, 17), maxAttendees: 25, notes: null,
    },
    {
      id: 'evt-8', title: 'Hamburger Hafenrundfahrt', description: 'Teambuilding-Event auf dem Wasser! Wir mieten ein Boot für eine 2-stündige Hafenrundfahrt mit Guide. Danach Fischbrötchen am Fischmarkt.',
      type: 'LEISURE', locationId: 'loc-hamburg', startDate: d(10, 14), endDate: d(10, 18), maxAttendees: 20, notes: 'Wetterfeste Kleidung empfohlen',
    },
    {
      id: 'evt-9', title: 'Cloud Architecture Deep Dive', description: 'Zwei Tage intensives Training zu AWS und Azure Architektur-Patterns. Praxisorientiert mit Hands-on Labs in der Cloud. Zertifizierungsvorbereitung möglich.',
      type: 'TRAINING', locationId: 'loc-muenchen', startDate: d(8, 9), endDate: d(9, 17), maxAttendees: 15, notes: 'AWS Free Tier Account erforderlich',
    },
    {
      id: 'evt-10', title: 'Weihnachtsfeier Frankfurt', description: 'Die Weihnachtsfeier des Frankfurter adesso-Teams! Festliches Dinner, Tombola und Musik in exklusivem Ambiente.',
      type: 'COMPANY', locationId: 'loc-frankfurt', startDate: d(45, 19), endDate: d(45, 23), maxAttendees: 80, notes: 'Dresscode: Business Casual',
    },
    {
      id: 'evt-11', title: 'Kicker-Turnier Köln', description: 'Wer hat die schnellsten Hände? Unser Kicker-Turnier im Kölner Büro! Teams aus je 2 Personen. Anmeldung als Team.',
      type: 'SPORT', locationId: 'loc-koeln', startDate: d(6, 16), endDate: d(6, 19), maxAttendees: 24, notes: 'Teams à 2 Personen',
    },
    {
      id: 'evt-12', title: 'Design Thinking Workshop', description: 'Lerne die Design Thinking Methode kennen und wende sie auf echte Projektprobleme an. Moderiert von unserem Innovation Lab.',
      type: 'TRAINING', locationId: 'loc-dortmund', startDate: d(12, 9), endDate: d(12, 17), maxAttendees: 18, notes: 'Für alle Rollen geeignet',
    },
  ];

  for (const evt of events) {
    await prisma.event.upsert({
      where: { id: evt.id },
      update: {},
      create: { ...evt, organizerId: organizer.id, status: 'ACTIVE' },
    });
  }
  console.log(`   ✅ ${events.length} Events erstellt\n`);

  // ─── Beispiel-Swipes für Demo-User ────────────────────────────
  console.log('👆 Erstelle Beispiel-Swipes für Demo User...');
  const rightSwipes = ['evt-1', 'evt-2', 'evt-5'];
  const leftSwipes  = ['evt-10', 'evt-11'];

  for (const eventId of rightSwipes) {
    await prisma.swipe.upsert({
      where: { userId_eventId: { userId: demo.id, eventId } },
      update: {},
      create: { userId: demo.id, eventId, direction: 'RIGHT' },
    });
    await prisma.attendance.upsert({
      where: { userId_eventId: { userId: demo.id, eventId } },
      update: {},
      create: { userId: demo.id, eventId, status: 'CONFIRMED' },
    });
  }
  for (const eventId of leftSwipes) {
    await prisma.swipe.upsert({
      where: { userId_eventId: { userId: demo.id, eventId } },
      update: {},
      create: { userId: demo.id, eventId, direction: 'LEFT' },
    });
  }
  console.log(`   ✅ ${rightSwipes.length} Zusagen + ${leftSwipes.length} Ablehnungen für Demo User\n`);

  console.log('✅ Seeding abgeschlossen!\n');
  console.log('─────────────────────────────────');
  console.log('🔑 Login-Accounts:');
  console.log('   demo@adesso.de     → Nutzer (Dortmund)');
  console.log('   organizer@adesso.de → Organisator');
  console.log('   admin@adesso.de    → Admin');
  console.log('─────────────────────────────────');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
