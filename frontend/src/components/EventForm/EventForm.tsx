import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';
import { useAuthStore } from '../../store/auth';

interface Location { id: string; name: string; city: string; }

const EVENT_TYPES = ['SPORT', 'MEETING', 'LEISURE', 'TRAINING', 'COMPANY', 'OTHER'] as const;
const TYPE_EMOJI: Record<string, string> = {
  SPORT: '🏆', MEETING: '📋', LEISURE: '🎉', TRAINING: '🎓', COMPANY: '🏢', OTHER: '📌',
};

interface Props {
  onSuccess?: () => void;
  editEventId?: string | null;
}

export function EventForm({ onSuccess, editEventId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isEdit = !!editEventId;

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '', description: '', type: 'SPORT', locationId: user?.locationId ?? '',
    startDate: '', startTime: '', maxAttendees: '', notes: '',
    audienceType: 'ALL' as 'ALL' | 'LOCATION' | 'BUSINESS_LINE' | 'CC' | 'SPECIFIC',
    audienceValue: '',
  });

  useEffect(() => {
    api.get('/admin/locations').then((r) => setLocations(r.data));
  }, []);

  useEffect(() => {
    if (!editEventId) return;
    setFetching(true);
    api.get(`/events/${editEventId}`).then((r) => {
      const e = r.data;
      const localDate = new Date(e.startDate);
      const pad = (n: number) => String(n).padStart(2, '0');
      const datetimeLocal = `${localDate.getFullYear()}-${pad(localDate.getMonth() + 1)}-${pad(localDate.getDate())}T${pad(localDate.getHours())}:${pad(localDate.getMinutes())}`;
      setForm({
        title: e.title,
        description: e.description,
        type: e.type,
        locationId: e.locationId,
        startDate: datetimeLocal.slice(0, 10),
        startTime: datetimeLocal.slice(11, 16),
        maxAttendees: e.maxAttendees ? String(e.maxAttendees) : '',
        notes: e.notes ?? '',
        audienceType: e.audienceType ?? 'ALL',
        audienceValue: e.audienceValue ?? '',
      });
      setFetching(false);
    });
  }, [editEventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Build audienceValue: for LOCATION store JSON array, for others plain string
      let audienceValue: string | undefined = undefined;
      if (form.audienceType === 'LOCATION') {
        const ids = form.audienceValue.split(',').map((s) => s.trim()).filter(Boolean);
        audienceValue = ids.length ? JSON.stringify(ids) : undefined;
      } else if (form.audienceType === 'SPECIFIC') {
        const targets = form.audienceValue.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
        audienceValue = targets.length ? JSON.stringify(targets) : undefined;
      } else if (form.audienceType !== 'ALL') {
        audienceValue = form.audienceValue.trim() || undefined;
      }

      const payload = {
        ...form,
        startDate: new Date(`${form.startDate}T${form.startTime || '00:00'}`).toISOString(),
        maxAttendees: form.maxAttendees ? parseInt(form.maxAttendees) : undefined,
        audienceValue,
      };
      if (isEdit) {
        await api.put(`/events/${editEventId}`, payload);
      } else {
        await api.post('/events', payload);
      }
      setSuccess(true);
      setTimeout(() => { onSuccess?.(); }, 1500);
    } catch {
      setError(isEdit ? 'Event konnte nicht gespeichert werden.' : 'Event konnte nicht erstellt werden. Bitte alle Pflichtfelder prüfen.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B6E]";

  if (fetching) {
    return <div className="flex justify-center pt-16"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0D3B6E]" /></div>;
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center px-4">
        <span className="text-6xl mb-4">{isEdit ? '✏️' : '🎉'}</span>
        <p className="text-xl font-bold text-gray-900">{isEdit ? 'Event aktualisiert!' : 'Event veröffentlicht!'}</p>
        <p className="text-sm text-gray-500 mt-1">{isEdit ? 'Änderungen wurden gespeichert.' : 'Wird jetzt im Feed angezeigt.'}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-6 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-gray-900">
          {isEdit ? 'Event bearbeiten' : t('createEvent.title')}
        </h1>
        {isEdit && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">Bearbeitung</span>}
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">{t('createEvent.titleLabel')} *</label>
        <input required className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">{t('createEvent.type')} *</label>
        <div className="grid grid-cols-3 gap-2">
          {EVENT_TYPES.map((type) => {
            const selected = form.type === type;
            return (
              <button key={type} type="button"
                onClick={() => setForm({ ...form, type })}
                className={`flex flex-col items-center justify-center gap-1.5 py-3 px-1 rounded-xl border-2 transition-all active:scale-95 ${
                  selected
                    ? 'bg-[#0D3B6E] border-[#0D3B6E] text-white shadow-md'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-[#0D3B6E] hover:bg-blue-50'
                }`}
              >
                <span className="text-2xl leading-none">{TYPE_EMOJI[type]}</span>
                <span className={`text-[11px] font-semibold text-center leading-tight ${selected ? 'text-white' : 'text-gray-600'}`}>
                  {t(`event.type.${type}`)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 min-w-0">
          <label className="text-sm font-medium text-gray-700 mb-1 block">Datum *</label>
          <input
            required
            type="date"
            className={inputClass}
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
        </div>
        <div className="w-28 flex-shrink-0">
          <label className="text-sm font-medium text-gray-700 mb-1 block">Uhrzeit *</label>
          <input
            required
            type="time"
            className={inputClass}
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">{t('createEvent.location')} *</label>
        <select required className={inputClass} value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })}>
          <option value="">Standort wählen...</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name} – {l.city}</option>)}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">Zielgruppe *</label>
        <div className="grid grid-cols-2 gap-2 mb-3">
          {([
            { value: 'ALL',           label: 'Alle adessi',        emoji: '🌍' },
            { value: 'LOCATION',      label: 'Standort(e)',        emoji: '📍' },
            { value: 'BUSINESS_LINE', label: 'Business Line',      emoji: '🏢' },
            { value: 'CC',            label: 'Competence Center',  emoji: '🎓' },
            { value: 'SPECIFIC',      label: 'Bestimmte adessi',   emoji: '👥' },
          ] as const).map(({ value, label, emoji }) => (
            <button key={value} type="button"
              onClick={() => setForm({ ...form, audienceType: value, audienceValue: '' })}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all active:scale-95 ${
                form.audienceType === value
                  ? 'bg-[#0D3B6E] border-[#0D3B6E] text-white'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-[#0D3B6E]'
              }`}
            >
              <span>{emoji}</span><span>{label}</span>
            </button>
          ))}
        </div>

        {form.audienceType === 'LOCATION' && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Standorte auswählen</label>
            <div className="space-y-1 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-2">
              {locations.map((l) => {
                const selected = form.audienceValue.split(',').map((s) => s.trim()).includes(l.id);
                return (
                  <label key={l.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-2 py-1">
                    <input type="checkbox" checked={selected}
                      onChange={() => {
                        const ids = form.audienceValue.split(',').map((s) => s.trim()).filter(Boolean);
                        const next = selected ? ids.filter((id) => id !== l.id) : [...ids, l.id];
                        setForm({ ...form, audienceValue: next.join(',') });
                      }}
                      className="accent-[#0D3B6E]"
                    />
                    <span className="text-sm">{l.name} – {l.city}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {form.audienceType === 'BUSINESS_LINE' && (
          <input className={inputClass} placeholder="z.B. Digital Experience" value={form.audienceValue}
            onChange={(e) => setForm({ ...form, audienceValue: e.target.value })} />
        )}

        {form.audienceType === 'CC' && (
          <input className={inputClass} placeholder="z.B. Cloud & Infrastructure" value={form.audienceValue}
            onChange={(e) => setForm({ ...form, audienceValue: e.target.value })} />
        )}

        {form.audienceType === 'SPECIFIC' && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">E-Mails eingeben (eine pro Zeile oder kommagetrennt)</label>
            <textarea rows={3} className={inputClass} placeholder="max.mustermann@adesso.de&#10;anna.schmidt@adesso.de"
              value={form.audienceValue}
              onChange={(e) => setForm({ ...form, audienceValue: e.target.value })} />
          </div>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">{t('createEvent.description')} *</label>
        <textarea required rows={3} className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">{t('createEvent.maxAttendees')}</label>
        <input type="number" min={1} className={inputClass} value={form.maxAttendees} onChange={(e) => setForm({ ...form, maxAttendees: e.target.value })} />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 mb-1 block">{t('createEvent.notes')}</label>
        <textarea rows={2} className={inputClass} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex gap-3">
        {isEdit && (
          <button type="button" onClick={() => onSuccess?.()} className="flex-1 border border-gray-300 text-gray-600 font-semibold py-3 rounded-xl hover:bg-gray-50 transition-colors">
            Abbrechen
          </button>
        )}
        <button type="submit" disabled={loading}
          className="flex-1 bg-[#0D3B6E] text-white font-semibold py-3 rounded-xl hover:bg-[#1A6FBF] transition-colors disabled:opacity-50"
        >
          {loading ? '...' : isEdit ? 'Speichern' : t('createEvent.submit')}
        </button>
      </div>
    </form>
  );
}
