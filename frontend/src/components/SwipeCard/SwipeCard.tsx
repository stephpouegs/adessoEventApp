import { forwardRef, useImperativeHandle, useState } from 'react';
import { useSpring, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { useTranslation } from 'react-i18next';

interface Event {
  id: string;
  title: string;
  type: string;
  startDate: string;
  description?: string;
  imageUrl?: string;
  source?: string;
  location: { name: string; city: string };
  _count?: { attendances: number };
  maxAttendees?: number;
}

interface SwipeCardProps {
  event: Event;
  onSwipe: (eventId: string, direction: 'RIGHT' | 'LEFT') => void;
  onTap?: (eventId: string) => void;
  isTop: boolean;
}

export interface SwipeCardHandle {
  swipe: (direction: 'RIGHT' | 'LEFT') => void;
}

const EVENT_TYPE_EMOJI: Record<string, string> = {
  SPORT: '🏆', MEETING: '📋', LEISURE: '🎉', TRAINING: '🎓', COMPANY: '🏢', OTHER: '📌',
};

export const SwipeCard = forwardRef<SwipeCardHandle, SwipeCardProps>(
  ({ event, onSwipe, onTap, isTop }, ref) => {
    const { t } = useTranslation();
    const [showInfo, setShowInfo] = useState(false);
    const [{ x, rotate, opacity }, springApi] = useSpring(() => ({ x: 0, rotate: 0, opacity: 1 }));

    // Programmatischer Swipe — wird von den Buttons aufgerufen
    useImperativeHandle(ref, () => ({
      swipe(direction: 'RIGHT' | 'LEFT') {
        springApi.start({
          x: direction === 'RIGHT' ? 600 : -600,
          rotate: direction === 'RIGHT' ? 20 : -20,
          opacity: 0,
        });
        setTimeout(() => onSwipe(event.id, direction), 300);
      },
    }));

    const bind = useDrag(
      ({ active, movement: [mx], velocity: [vx], tap, cancel, event: nativeEvent }) => {
        // Keine Swipe-Geste wenn Klick auf ⓘ-Button oder Popup
        if ((nativeEvent?.target as HTMLElement)?.closest?.('[data-no-drag]')) {
          cancel?.();
          return;
        }
        if (tap) {
          onTap?.(event.id);
          return;
        }
        const trigger = Math.abs(mx) > 100 || (Math.abs(vx) > 0.5 && Math.abs(mx) > 40);
        if (!active && trigger) {
          const dir = mx > 0 ? 'RIGHT' : 'LEFT';
          springApi.start({ x: dir === 'RIGHT' ? 600 : -600, rotate: dir === 'RIGHT' ? 20 : -20, opacity: 0 });
          setTimeout(() => onSwipe(event.id, dir), 300);
        } else {
          springApi.start({ x: active ? mx : 0, rotate: active ? mx / 20 : 0, opacity: 1, immediate: active });
        }
      },
      { enabled: isTop, filterTaps: true }
    );

    const rightOpacity = x.to((v) => v > 0 ? Math.min(v / 80, 1) : 0);
    const leftOpacity  = x.to((v) => v < 0 ? Math.min(-v / 80, 1) : 0);

    return (
      <animated.div
        {...bind()}
        style={{ x, rotate, opacity, touchAction: 'none' }}
        className="absolute inset-0 cursor-grab active:cursor-grabbing select-none"
      >
        <div className="h-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100 flex flex-col">
          {/* Interesse-Badge */}
          <animated.div
            style={{ opacity: rightOpacity }}
            className="absolute top-5 left-1/2 -translate-x-1/2 z-10 bg-green-500 text-white font-bold text-lg px-5 py-2 rounded-full shadow-lg select-none whitespace-nowrap"
          >
            ♥ Interesse
          </animated.div>
          {/* Ablehnen-Badge */}
          <animated.div
            style={{ opacity: leftOpacity }}
            className="absolute top-5 left-1/2 -translate-x-1/2 z-10 bg-red-500 text-white font-bold text-lg px-5 py-2 rounded-full shadow-lg select-none whitespace-nowrap"
          >
            × Ablehnen
          </animated.div>

          {/* Bild – wächst und füllt den freien Platz */}
          <div className="flex-1 min-h-0 bg-gradient-to-br from-[#0D3B6E] to-[#1A6FBF] flex items-center justify-center relative">
            {event.imageUrl ? (
              <img src={event.imageUrl} alt={event.title} className="w-full h-full object-cover" />
            ) : (
              <span className="text-6xl">{EVENT_TYPE_EMOJI[event.type] || '📌'}</span>
            )}

            {/* Info-Button */}
            {event.description && (
              <button
                data-no-drag
                type="button"
                onClick={() => setShowInfo((v) => !v)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 backdrop-blur-sm text-[#0D3B6E] font-bold text-sm shadow-md flex items-center justify-center hover:bg-white transition-colors z-20 select-none"
                aria-label="Beschreibung anzeigen"
              >
                i
              </button>
            )}

            {/* Beschreibungs-Popup */}
            {showInfo && event.description && (
              <div
                data-no-drag
                className="absolute inset-0 z-10 flex items-center justify-center p-4"
                onClick={() => setShowInfo(false)}
              >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm rounded-t-2xl" />
                <div
                  className="relative bg-white rounded-2xl shadow-xl p-4 max-h-full overflow-y-auto w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-[#1A6FBF] uppercase tracking-wide">
                      {EVENT_TYPE_EMOJI[event.type]} {event.title}
                    </span>
                    <button
                      data-no-drag
                      onClick={() => setShowInfo(false)}
                      className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center hover:bg-gray-200"
                      aria-label="Schließen"
                    >
                      ✕
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{event.description}</p>
                </div>
              </div>
            )}
          </div>

          {/* Inhalt – feste Höhe unten */}
          <div className="flex-shrink-0 px-4 py-3 space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#1A6FBF] uppercase tracking-wide">
                {EVENT_TYPE_EMOJI[event.type]} {t(`event.type.${event.type}`)}
              </span>
              {event.source === 'TEAMS' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-1.5 py-0.5 rounded bg-[#4B53BC] text-white">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 3H4a1 1 0 00-1 1v16a1 1 0 001 1h16a1 1 0 001-1V4a1 1 0 00-1-1zm-5 10h-2v2h-2v-2H9v-2h2V9h2v2h2v2z"/>
                  </svg>
                  Teams
                </span>
              )}
            </div>
            <h2 className="text-base font-bold text-gray-900 leading-tight">{event.title}</h2>
            <div className="flex flex-col gap-0.5 text-sm text-gray-500">
              <span>📅 {new Date(event.startDate).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span>
              <span>📍 {event.location.city}</span>
              {event.maxAttendees && (
                <span>👥 {event._count?.attendances ?? 0} / {event.maxAttendees} {t('event.attendees')}</span>
              )}
            </div>
          </div>
        </div>
      </animated.div>
    );
  }
);

SwipeCard.displayName = 'SwipeCard';
