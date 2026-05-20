import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import api from '../api/client';
import { EventDetail } from '../components/EventDetail/EventDetail';

interface Attendance {
  id: string;
  status: string;
  event: {
    id: string;
    title: string;
    type: string;
    startDate: string;
    location: { city: string };
  };
}

interface OrgEvent {
  id: string;
  title: string;
  type: string;
  status: string;
  startDate: string;
  location: { name: string; city: string };
  _count: { attendances: number };
  maxAttendees?: number;
}

const EVENT_TYPE_EMOJI: Record<string, string> = {
  SPORT: '🏆', MEETING: '📋', LEISURE: '🎉', TRAINING: '🎓', COMPANY: '🏢', OTHER: '📌',
};

export function MyEvents({ onEdit }: { onEdit?: (eventId: string) => void }) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isOrganizer = user?.role === 'ORGANIZER' || user?.role === 'ADMIN';

  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [orgEvents, setOrgEvents] = useState<OrgEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancellingEvent, setCancellingEvent] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const requests: Promise<any>[] = [api.get('/attendance/my')];
    if (isOrganizer) requests.push(api.get('/events/my'));
    const [attRes, orgRes] = await Promise.all(requests);
    setAttendances(attRes.data);
    if (orgRes) setOrgEvents(orgRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCancel = async (eventId: string) => {
    setCancelling(eventId);
    try {
      await api.delete(`/attendance/${eventId}`);
      setAttendances((prev) => prev.filter((a) => a.event.id !== eventId));
    } finally {
      setCancelling(null);
    }
  };

  const handleCancelEvent = async (eventId: string) => {
    if (!confirm('Event wirklich absagen? Alle Teilnehmer werden benachrichtigt.')) return;
    setCancellingEvent(eventId);
    try {
      await api.delete(`/events/${eventId}`);
      setOrgEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, status: 'CANCELLED' } : e));
    } finally {
      setCancellingEvent(null);
    }
  };

  const now = new Date();
  const upcoming = attendances.filter((a) => new Date(a.event.startDate) >= now);
  const past = attendances.filter((a) => new Date(a.event.startDate) < now);
  const activeOrgEvents = orgEvents.filter((e) => e.status !== 'CANCELLED');
  const cancelledOrgEvents = orgEvents.filter((e) => e.status === 'CANCELLED');

  if (loading) {
    return <div className="flex justify-center pt-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0D3B6E]" /></div>;
  }

  const AttendanceCard = ({ att, canCancel }: { att: Attendance; canCancel: boolean }) => (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex gap-3 items-start cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => setSelectedEventId(att.event.id)}
    >
      <span className="text-2xl mt-0.5">{EVENT_TYPE_EMOJI[att.event.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 leading-tight">{att.event.title}</p>
        <p className="text-sm text-gray-500 mt-0.5">
          📅 {new Date(att.event.startDate).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
        </p>
        <p className="text-sm text-gray-500">📍 {att.event.location.city}</p>
        {att.status === 'WAITLIST' && (
          <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full mt-1 inline-block">Warteliste</span>
        )}
      </div>
      {canCancel && (
        <button
          onClick={(e) => { e.stopPropagation(); handleCancel(att.event.id); }}
          disabled={cancelling === att.event.id}
          className="text-xs text-red-500 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50 active:scale-95 transition-all disabled:opacity-40 flex-shrink-0"
        >
          {cancelling === att.event.id ? '...' : 'Abmelden'}
        </button>
      )}
    </div>
  );

  const OrgEventCard = ({ event }: { event: OrgEvent }) => {
    const isCancelled = event.status === 'CANCELLED';
    const spotsLeft = event.maxAttendees ? event.maxAttendees - event._count.attendances : null;
    return (
      <div
        className={`bg-white rounded-xl shadow-sm border p-4 flex gap-3 items-start cursor-pointer hover:shadow-md transition-shadow ${isCancelled ? 'border-red-100 opacity-60' : 'border-gray-100'}`}
        onClick={() => setSelectedEventId(event.id)}
      >
        <span className="text-2xl mt-0.5">{EVENT_TYPE_EMOJI[event.type]}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 leading-tight">{event.title}</p>
            {isCancelled && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Abgesagt</span>}
          </div>
          <p className="text-sm text-gray-500 mt-0.5">
            📅 {new Date(event.startDate).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="text-sm text-gray-500">📍 {event.location.name}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-gray-500">
              👥 {event._count.attendances}{event.maxAttendees ? ` / ${event.maxAttendees}` : ''} Teilnehmer
            </span>
            {spotsLeft !== null && spotsLeft <= 3 && !isCancelled && (
              <span className="text-xs text-orange-500 font-semibold">Nur noch {spotsLeft} Plätze!</span>
            )}
            {spotsLeft !== null && spotsLeft <= 0 && !isCancelled && (
              <span className="text-xs text-red-500 font-semibold">Ausgebucht</span>
            )}
          </div>
        </div>
        {!isCancelled && new Date(event.startDate) >= now && (
          <div className="flex flex-col gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {onEdit && (
              <button
                onClick={() => onEdit(event.id)}
                className="text-xs text-[#0D3B6E] border border-[#0D3B6E]/30 rounded-lg px-2 py-1 hover:bg-blue-50 active:scale-95 transition-all"
              >
                Bearbeiten
              </button>
            )}
            <button
              onClick={() => handleCancelEvent(event.id)}
              disabled={cancellingEvent === event.id}
              className="text-xs text-red-500 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50 active:scale-95 transition-all disabled:opacity-40"
            >
              {cancellingEvent === event.id ? '...' : 'Absagen'}
            </button>
          </div>
        )}
      </div>
    );
  };

  const hasAttendances = attendances.length > 0;
  const hasOrgEvents = orgEvents.length > 0;

  if (!hasAttendances && !hasOrgEvents) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <span className="text-5xl mb-4">📅</span>
        <p className="text-gray-600">{t('myEvents.empty')}</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">

      {/* ── Meine Anmeldungen (User-Sicht) ── */}
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {t('myEvents.upcoming')} ({upcoming.length})
          </h2>
          <div className="space-y-3">
            {upcoming.map((a) => <AttendanceCard key={a.id} att={a} canCancel />)}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            {t('myEvents.past')} ({past.length})
          </h2>
          <div className="space-y-3 opacity-60">
            {past.map((a) => <AttendanceCard key={a.id} att={a} canCancel={false} />)}
          </div>
        </section>
      )}

      {/* ── Meine organisierten Events (Organizer-Sicht) ── */}
      {isOrganizer && hasOrgEvents && (
        <section>
          <h2 className="text-sm font-semibold text-[#0D3B6E] uppercase tracking-wide mb-3">
            Meine organisierten Events ({activeOrgEvents.length})
          </h2>
          <div className="space-y-3">
            {activeOrgEvents.map((e) => <OrgEventCard key={e.id} event={e} />)}
          </div>

          {cancelledOrgEvents.length > 0 && (
            <div className="space-y-3 mt-3">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Abgesagte Events</p>
              {cancelledOrgEvents.map((e) => <OrgEventCard key={e.id} event={e} />)}
            </div>
          )}
        </section>
      )}

      {isOrganizer && !hasOrgEvents && (
        <section>
          <h2 className="text-sm font-semibold text-[#0D3B6E] uppercase tracking-wide mb-3">
            Meine organisierten Events
          </h2>
          <div className="bg-white rounded-xl border border-dashed border-gray-200 p-6 text-center">
            <p className="text-gray-400 text-sm">Noch keine Events erstellt.</p>
          </div>
        </section>
      )}

      {selectedEventId && (
        <EventDetail
          eventId={selectedEventId}
          onClose={() => setSelectedEventId(null)}
        />
      )}
    </div>
  );
}
