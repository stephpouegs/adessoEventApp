import { useEffect, useState } from 'react';
import api from '../api/client';
import { EventForm } from '../components/EventForm/EventForm';

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

type View = 'list' | 'new' | 'edit';

export function OrganizerDashboard() {
  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [editEventId, setEditEventId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadEvents = () => {
    setLoading(true);
    setError('');
    api.get('/events/my')
      .then((r) => { setEvents(r.data); })
      .catch(() => setError('Events konnten nicht geladen werden. Bitte Backend neu starten.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadEvents(); }, []);

  const handleCancel = async (eventId: string) => {
    if (!confirm('Event wirklich absagen? Alle Teilnehmer sehen es als abgesagt.')) return;
    setCancelling(eventId);
    try {
      await api.delete(`/events/${eventId}`);
      setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, status: 'CANCELLED' } : e));
    } finally {
      setCancelling(null);
    }
  };

  if (view === 'new') {
    return <EventForm onSuccess={() => { loadEvents(); setView('list'); }} />;
  }

  if (view === 'edit' && editEventId) {
    return <EventForm editEventId={editEventId} onSuccess={() => { loadEvents(); setView('list'); }} />;
  }

  const now = new Date();
  const active = events.filter((e) => e.status === 'ACTIVE');
  const cancelled = events.filter((e) => e.status === 'CANCELLED');

  return (
    <div className="px-4 py-6 space-y-5 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Meine Events</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {active.length} aktiv{cancelled.length > 0 ? ` · ${cancelled.length} abgesagt` : ''}
          </p>
        </div>
        <button
          onClick={() => setView('new')}
          className="bg-[#0D3B6E] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#1A6FBF] transition-colors flex items-center gap-1.5"
        >
          <span className="text-base">➕</span> Neues Event
        </button>
      </div>

      {loading && (
        <div className="flex justify-center pt-8">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0D3B6E]" />
        </div>
      )}

      {!loading && error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center space-y-3">
          <p className="text-red-600 text-sm font-medium">{error}</p>
          <button onClick={loadEvents} className="text-sm text-[#0D3B6E] underline">Erneut versuchen</button>
        </div>
      )}

      {!loading && events.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <span className="text-5xl block mb-3">📅</span>
          <p className="font-semibold text-gray-700">Noch keine Events erstellt</p>
          <p className="text-sm text-gray-400 mt-1">Klicke auf "Neues Event" um zu starten.</p>
        </div>
      )}

      {/* Aktive Events */}
      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktive Events ({active.length})</h2>
          {active.map((event) => {
            const isPast = new Date(event.startDate) < now;
            const spotsLeft = event.maxAttendees ? event.maxAttendees - event._count.attendances : null;
            const isFull = spotsLeft !== null && spotsLeft <= 0;
            return (
              <div key={event.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex gap-3 items-start">
                  <span className="text-2xl mt-0.5">{EVENT_TYPE_EMOJI[event.type]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 leading-tight">{event.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">
                      📅 {new Date(event.startDate).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-sm text-gray-500">📍 {event.location.name} – {event.location.city}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        👥 {event._count.attendances}{event.maxAttendees ? ` / ${event.maxAttendees}` : ''} Teilnehmer
                      </span>
                      {isFull && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">Ausgebucht</span>}
                      {!isFull && spotsLeft !== null && spotsLeft <= 3 && (
                        <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-semibold">Nur noch {spotsLeft} Plätze</span>
                      )}
                      {isPast && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Vergangen</span>}
                    </div>
                  </div>
                </div>

                {!isPast && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => { setEditEventId(event.id); setView('edit'); }}
                      className="flex-1 text-sm font-semibold py-2 rounded-xl border-2 border-[#0D3B6E] text-[#0D3B6E] hover:bg-blue-50 active:scale-95 transition-all"
                    >
                      ✏️ Bearbeiten
                    </button>
                    <button
                      onClick={() => handleCancel(event.id)}
                      disabled={cancelling === event.id}
                      className="flex-1 text-sm font-semibold py-2 rounded-xl border-2 border-red-400 text-red-500 hover:bg-red-50 active:scale-95 transition-all disabled:opacity-40"
                    >
                      {cancelling === event.id ? '...' : '✕ Absagen'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      )}

      {/* Abgesagte Events */}
      {cancelled.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Abgesagte Events ({cancelled.length})</h2>
          {cancelled.map((event) => (
            <div key={event.id} className="bg-white rounded-2xl border border-red-100 shadow-sm p-4 opacity-60">
              <div className="flex gap-3 items-start">
                <span className="text-2xl mt-0.5">{EVENT_TYPE_EMOJI[event.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 leading-tight">{event.title}</p>
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Abgesagt</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    📅 {new Date(event.startDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="text-sm text-gray-500">📍 {event.location.city}</p>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
