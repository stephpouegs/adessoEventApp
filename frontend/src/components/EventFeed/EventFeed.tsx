import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';
import { useAuthStore } from '../../store/auth';
import { SwipeCard } from '../SwipeCard/SwipeCard';
import type { SwipeCardHandle } from '../SwipeCard/SwipeCard';
import { EventDetail } from '../EventDetail/EventDetail';

interface Location { id: string; name: string; city: string; }

interface Event {
  id: string;
  title: string;
  type: string;
  startDate: string;
  description?: string;
  imageUrl?: string;
  location: { name: string; city: string };
  _count?: { attendances: number };
  maxAttendees?: number;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'decline' | 'waitlist';
}

const EVENT_TYPES = ['SPORT', 'MEETING', 'LEISURE', 'TRAINING', 'COMPANY', 'OTHER'] as const;
const TYPE_EMOJI: Record<string, string> = {
  SPORT: '🏆', MEETING: '📋', LEISURE: '🎉', TRAINING: '🎓', COMPANY: '🏢', OTHER: '📌',
};

export function EventFeed() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [lastSwiped, setLastSwiped] = useState<{ event: Event; direction: 'RIGHT' | 'LEFT' } | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>(user?.locationId ?? 'all');
  const topCardRef = useRef<SwipeCardHandle>(null);

  useEffect(() => {
    api.get('/admin/locations').then((r) => setLocations(r.data));
  }, []);

  const loadFeed = (locationId?: string) => {
    setLoading(true);
    setActiveFilter(null);
    const loc = locationId ?? selectedLocation;
    const params = loc && loc !== 'all' ? `?locationId=${loc}` : '?locationId=all';
    api.get(`/events/feed${params}`).then((r) => {
      setAllEvents(r.data);
      setEvents(r.data);
      setLoading(false);
    });
  };

  useEffect(() => { loadFeed(); }, []);

  const applyFilter = (type: string | null) => {
    setActiveFilter(type);
    setEvents(type ? allEvents.filter((e) => e.type === type) : allEvents);
  };

  const showToast = (message: string, type: 'success' | 'decline' | 'waitlist') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2500);
  };

  const handleSwipe = async (eventId: string, direction: 'RIGHT' | 'LEFT') => {
    const event = allEvents.find((e) => e.id === eventId);
    const res = await api.post('/swipe', { eventId, direction });
    setAllEvents((prev) => prev.filter((e) => e.id !== eventId));
    setEvents((prev) => prev.filter((e) => e.id !== eventId));
    if (event) setLastSwiped({ event, direction });
    if (direction === 'RIGHT') {
      if (res.data.attendanceStatus === 'WAITLIST') {
        showToast(`⏳ Warteliste: ${event?.title}`, 'waitlist');
      } else {
        showToast(`♥ Du nimmst teil: ${event?.title}`, 'success');
      }
    } else {
      showToast(`Übersprungen`, 'decline');
    }
  };

  const handleUndo = async () => {
    if (!lastSwiped) {
      loadFeed();
      return;
    }
    await api.delete(`/swipe/${lastSwiped.event.id}`);
    setAllEvents((prev) => [lastSwiped.event, ...prev]);
    setEvents((prev) => {
      const filtered = activeFilter ? [lastSwiped.event].filter((e) => e.type === activeFilter) : [lastSwiped.event];
      return [...filtered, ...prev];
    });
    setLastSwiped(null);
    showToast(`↩ Rückgängig: ${lastSwiped.event.title}`, 'decline');
  };

  const handleButtonClick = (direction: 'RIGHT' | 'LEFT') => {
    topCardRef.current?.swipe(direction);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0D3B6E]" />
      </div>
    );
  }

  const noCards = allEvents.length === 0;
  const noFiltered = !noCards && events.length === 0;

  return (
    <div className="feed-container flex flex-col gap-2 px-4 overflow-hidden"
         style={{ paddingTop: '10px', paddingBottom: '8px' }}>

      {/* Toast-Benachrichtigungen */}
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none w-full max-w-sm px-4">
        {toasts.map((toast) => (
          <div key={toast.id}
            className={`px-4 py-2 rounded-xl shadow-lg text-white text-sm font-semibold text-center
              ${toast.type === 'success' ? 'bg-green-500' : toast.type === 'waitlist' ? 'bg-yellow-500' : 'bg-gray-500'}`}>
            {toast.message}
          </div>
        ))}
      </div>

      {/* ── Filter (oben, feste Höhe) ── */}
      <div className="flex-shrink-0 flex flex-col gap-2">
        <div className="relative w-full">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#0D3B6E] text-base z-10">📍</span>
          <select
            value={selectedLocation}
            onChange={(e) => { setSelectedLocation(e.target.value); loadFeed(e.target.value); }}
            style={{ WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none' }}
            className="block w-full h-11 pl-9 pr-8 border-2 border-gray-200 rounded-2xl text-sm font-medium text-gray-800 bg-white shadow-sm"
          >
            <option value="all">Alle Standorte</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name} – {l.city}</option>
            ))}
          </select>
          <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 text-base">▾</span>
        </div>
        <div className="chips-scroll flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => applyFilter(null)}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              activeFilter === null ? 'bg-[#0D3B6E] text-white border-[#0D3B6E]' : 'bg-white text-gray-600 border-gray-200'}`}>
            Alle
          </button>
          {EVENT_TYPES.map((type) => (
            <button key={type} onClick={() => applyFilter(activeFilter === type ? null : type)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                activeFilter === type ? 'bg-[#0D3B6E] text-white border-[#0D3B6E]' : 'bg-white text-gray-600 border-gray-200'}`}>
              {TYPE_EMOJI[type]} {t(`event.type.${type}`)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Karte (wächst und füllt den gesamten Restplatz) ── */}
      {noCards ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <span className="text-5xl mb-3">🎉</span>
          <p className="text-base font-semibold text-gray-700">{t('feed.empty')}</p>
          {lastSwiped && (
            <p className="text-xs text-gray-400 mt-1">⟲ drücken um letzten Swipe rückgängig zu machen</p>
          )}
        </div>
      ) : noFiltered ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <span className="text-4xl mb-2">🔍</span>
          <p className="text-gray-600 font-medium text-sm">
            {activeFilter ? 'Keine Events für diesen Typ.' : 'Keine Events für diesen Standort.'}
          </p>
          <div className="flex gap-3 mt-2">
            {activeFilter && (
              <button onClick={() => applyFilter(null)} className="text-sm text-[#0D3B6E] underline">Filter entfernen</button>
            )}
            {selectedLocation !== 'all' && !activeFilter && (
              <button onClick={() => { setSelectedLocation('all'); loadFeed('all'); }} className="text-sm text-[#0D3B6E] underline">Alle Standorte</button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 relative min-h-0">
          {events.slice(0, 3).map((event, i) => (
            <div key={event.id}
              style={{ zIndex: events.length - i, transform: `scale(${1 - i * 0.04}) translateY(${i * 8}px)` }}
              className="absolute inset-0">
              <SwipeCard
                ref={i === 0 ? topCardRef : null}
                event={event}
                onSwipe={handleSwipe}
                onTap={(id) => setSelectedEventId(id)}
                isTop={i === 0}
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Buttons (unten, immer sichtbar) ── */}
      <div className="flex-shrink-0 flex items-center justify-center gap-5 py-2">
        <button onClick={handleUndo}
          title={lastSwiped ? `Rückgängig: ${lastSwiped.event.title}` : 'Feed neu laden'}
          className={`w-12 h-12 rounded-full shadow-md border text-xl active:scale-95 transition-all flex items-center justify-center
            ${lastSwiped
              ? 'bg-yellow-400 border-yellow-400 text-white scale-110 animate-pulse'
              : 'bg-white border-gray-200 text-yellow-400'}`}
          aria-label={lastSwiped ? 'Undo' : 'Reload'}>⟲</button>
        <button onClick={() => handleButtonClick('LEFT')} disabled={noCards}
          className="w-14 h-14 rounded-full bg-white shadow-lg border border-gray-200 text-red-500 text-2xl active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={t('feed.swipeLeft')}>✕</button>
        <button onClick={() => handleButtonClick('RIGHT')} disabled={noCards}
          className="w-14 h-14 rounded-full bg-white shadow-lg border border-gray-200 text-green-500 text-2xl active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={t('feed.swipeRight')}>♥</button>
        <button onClick={() => {
            const loc = events[0]?.location;
            if (loc) window.open(`https://maps.google.com?q=${encodeURIComponent(loc.name + ' ' + loc.city)}`, '_blank');
          }} disabled={noCards}
          className="w-12 h-12 rounded-full bg-white shadow-md border border-gray-200 text-blue-500 text-xl active:scale-95 transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label="Standort anzeigen">📍</button>
      </div>

      {selectedEventId && (
        <EventDetail eventId={selectedEventId} onClose={() => setSelectedEventId(null)} topCardRef={topCardRef} />
      )}
    </div>
  );
}
