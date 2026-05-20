import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SwipeCardHandle } from '../SwipeCard/SwipeCard';
import api from '../../api/client';

interface EventDetail {
  id: string;
  title: string;
  type: string;
  description: string;
  startDate: string;
  endDate?: string;
  imageUrl?: string;
  maxAttendees?: number;
  notes?: string;
  location: { name: string; city: string; address?: string };
  organizer: { name: string; email: string };
  _count: { attendances: number };
}

interface Props {
  eventId: string;
  onClose: () => void;
  topCardRef?: React.RefObject<SwipeCardHandle | null>;
}

const EVENT_TYPE_EMOJI: Record<string, string> = {
  SPORT: '🏆', MEETING: '📋', LEISURE: '🎉', TRAINING: '🎓', COMPANY: '🏢', OTHER: '📌',
};

export function EventDetail({ eventId, onClose, topCardRef }: Props) {
  const { t } = useTranslation();
  const [event, setEvent] = useState<EventDetail | null>(null);

  useEffect(() => {
    api.get(`/events/${eventId}`).then((r) => setEvent(r.data));
  }, [eventId]);

  const handleAction = (direction: 'RIGHT' | 'LEFT') => {
    onClose();
    setTimeout(() => {
      topCardRef?.current?.swipe(direction);
    }, 200);
  };

  if (!event) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose}>
        <div className="bg-white w-full max-w-lg rounded-t-3xl p-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0D3B6E]" />
        </div>
      </div>
    );
  }

  const spotsLeft = event.maxAttendees ? event.maxAttendees - event._count.attendances : null;
  const isFull = spotsLeft !== null && spotsLeft <= 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl overflow-hidden shadow-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Bild-Header */}
        <div className="relative h-56 bg-gradient-to-br from-[#0D3B6E] to-[#1A6FBF] flex-shrink-0">
          {event.imageUrl ? (
            <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-8xl">{EVENT_TYPE_EMOJI[event.type] || '📌'}</span>
            </div>
          )}
          {/* Schließen-Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 bg-black/40 hover:bg-black/60 text-white rounded-full flex items-center justify-center text-lg transition-colors"
          >
            ✕
          </button>
          {/* Event-Typ Badge */}
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-semibold text-[#0D3B6E]">
            {EVENT_TYPE_EMOJI[event.type]} {t(`event.type.${event.type}`)}
          </div>
        </div>

        {/* Inhalt — scrollbar */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>

          {/* Infos */}
          <div className="grid grid-cols-2 gap-3">
            <InfoCard icon="📅" label="Datum">
              {new Date(event.startDate).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </InfoCard>
            <InfoCard icon="⏰" label="Uhrzeit">
              {new Date(event.startDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              {event.endDate && ` – ${new Date(event.endDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}`}
            </InfoCard>
            <InfoCard icon="📍" label="Standort">
              {event.location.name}
              {event.location.address && <span className="block text-xs text-gray-400">{event.location.address}</span>}
            </InfoCard>
            <InfoCard icon="👥" label={t('event.attendees')}>
              {event._count.attendances}
              {event.maxAttendees && ` / ${event.maxAttendees}`}
              {isFull && <span className="block text-xs text-red-500 font-semibold">Ausgebucht</span>}
              {spotsLeft !== null && !isFull && spotsLeft <= 3 && (
                <span className="block text-xs text-orange-500 font-semibold">Nur noch {spotsLeft} Plätze!</span>
              )}
            </InfoCard>
          </div>

          {/* Beschreibung */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Beschreibung</h3>
            <p className="text-gray-700 text-sm leading-relaxed">{event.description}</p>
          </div>

          {/* Hinweise */}
          {event.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-sm text-amber-800">⚠️ <span className="font-semibold">Hinweis:</span> {event.notes}</p>
            </div>
          )}

          {/* Organisator */}
          <div className="text-xs text-gray-400 pb-2">
            Organisiert von <span className="font-medium text-gray-500">{event.organizer.name}</span>
          </div>
        </div>

        {/* Aktions-Buttons */}
        <div className="flex gap-3 px-5 py-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={() => handleAction('LEFT')}
            className="flex-1 py-3 rounded-xl border-2 border-red-400 text-red-500 font-semibold hover:bg-red-50 active:scale-95 transition-all"
          >
            ✕ {t('event.decline')}
          </button>
          <button
            onClick={() => handleAction('RIGHT')}
            disabled={isFull}
            className="flex-1 py-3 rounded-xl bg-[#0D3B6E] text-white font-semibold hover:bg-[#1A6FBF] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ♥ {isFull ? 'Ausgebucht' : t('event.join')}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="text-lg mb-0.5">{icon}</div>
      <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</div>
      <div className="text-sm font-semibold text-gray-800 mt-0.5">{children}</div>
    </div>
  );
}
