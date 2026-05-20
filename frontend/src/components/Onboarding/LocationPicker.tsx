import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';

interface Location { id: string; name: string; city: string; }

interface Props {
  onComplete: (locationId: string) => void;
}

export function LocationPicker({ onComplete }: Props) {
  useTranslation();
  const [locations, setLocations] = useState<Location[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/admin/locations').then((r) => setLocations(r.data));
  }, []);

  const filtered = locations.filter(
    (l) => l.name.toLowerCase().includes(search.toLowerCase()) || l.city.toLowerCase().includes(search.toLowerCase())
  );

  const handleConfirm = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.put('/user/location', { locationId: selected });
      onComplete(selected);
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D3B6E] flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <span className="text-5xl">📍</span>
          <h1 className="text-2xl font-bold text-white mt-3">Dein Standort</h1>
          <p className="text-white/70 text-sm mt-1">Wo arbeitest du hauptsächlich?</p>
        </div>

        {/* Suchfeld */}
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            className="w-full bg-white rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
            placeholder="Standort suchen..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Standortliste */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-xl mb-4 max-h-72 overflow-y-auto">
          {filtered.map((loc, i) => (
            <button
              key={loc.id}
              onClick={() => setSelected(loc.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors
                ${i > 0 ? 'border-t border-gray-100' : ''}
                ${selected === loc.id ? 'bg-[#0D3B6E]/10' : 'hover:bg-gray-50'}`}
            >
              <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center
                ${selected === loc.id ? 'border-[#0D3B6E] bg-[#0D3B6E]' : 'border-gray-300'}`}
              >
                {selected === loc.id && <span className="w-2 h-2 bg-white rounded-full" />}
              </span>
              <div>
                <p className="font-semibold text-sm text-gray-900">{loc.name}</p>
                <p className="text-xs text-gray-400">{loc.city}</p>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-400">Kein Standort gefunden</div>
          )}
        </div>

        {/* Bestätigen */}
        <button
          onClick={handleConfirm}
          disabled={!selected || saving}
          className="w-full bg-white text-[#0D3B6E] font-bold py-3.5 rounded-xl hover:bg-gray-100 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Wird gespeichert...' : `Weiter →`}
        </button>
      </div>
    </div>
  );
}
