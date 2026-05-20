import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/auth';
import api from '../api/client';

interface Location { id: string; name: string; city: string; }

const ROLE_LABEL: Record<string, { label: string; color: string }> = {
  USER: { label: 'Mitarbeiter', color: 'bg-blue-100 text-blue-700' },
  ORGANIZER: { label: 'Organisator', color: 'bg-purple-100 text-purple-700' },
  ADMIN: { label: 'Administrator', color: 'bg-red-100 text-red-700' },
};

export function Profile() {
  const { i18n } = useTranslation();
  const { user, setUser } = useAuthStore();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLoc, setSelectedLoc] = useState(user?.locationId ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiOptIn, setAiOptIn] = useState(true);

  useEffect(() => {
    api.get('/admin/locations').then((r) => setLocations(r.data));
  }, []);

  const currentLocation = locations.find((l) => l.id === selectedLoc);

  const saveSettings = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await Promise.all([
        api.put('/user/location', { locationId: selectedLoc }),
        api.put('/user/settings', { language: i18n.language, aiOptIn }),
      ]);
      setUser({ ...user, locationId: selectedLoc });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  const roleInfo = ROLE_LABEL[user.role] ?? { label: user.role, color: 'bg-gray-100 text-gray-700' };

  return (
    <div className="px-4 py-6 space-y-5 max-w-lg mx-auto">
      {/* Profil-Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-[#0D3B6E] text-white flex items-center justify-center text-2xl font-bold flex-shrink-0">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-lg truncate">{user.name}</p>
          <p className="text-sm text-gray-500 truncate">{user.email}</p>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${roleInfo.color}`}>
            {roleInfo.label}
          </span>
        </div>
      </div>

      {/* Standort */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">Mein Standort</h2>
        {currentLocation && (
          <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 rounded-lg px-3 py-2">
            <span>📍</span>
            <span className="font-medium">{currentLocation.name} – {currentLocation.city}</span>
          </div>
        )}
        <select
          value={selectedLoc}
          onChange={(e) => setSelectedLoc(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B6E]"
        >
          <option value="">Standort wählen...</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name} – {l.city}</option>
          ))}
        </select>
      </div>

      {/* Sprache */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">Sprache / Language</h2>
        <div className="flex gap-3">
          {(['de', 'en'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => i18n.changeLanguage(lang)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                i18n.language === lang
                  ? 'bg-[#0D3B6E] text-white border-[#0D3B6E]'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-[#0D3B6E]'
              }`}
            >
              {lang === 'de' ? '🇩🇪 Deutsch' : '🇬🇧 English'}
            </button>
          ))}
        </div>
      </div>

      {/* KI-Personalisierung */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <p className="font-semibold text-gray-800 text-sm">KI-Personalisierung</p>
            <p className="text-xs text-gray-500 mt-0.5">Feed wird nach deinen Vorlieben sortiert</p>
          </div>
          <button
            type="button"
            onClick={() => setAiOptIn((v) => !v)}
            role="switch"
            aria-checked={aiOptIn}
            className={`flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0D3B6E] focus:ring-offset-2 ${aiOptIn ? 'bg-[#0D3B6E]' : 'bg-gray-300'}`}
          >
            <span
              className={`block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 mx-0.5 ${aiOptIn ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>
      </div>

      {/* Speichern */}
      <button
        onClick={saveSettings}
        disabled={saving || !selectedLoc}
        className="w-full bg-[#0D3B6E] text-white font-semibold py-3 rounded-xl hover:bg-[#1A6FBF] transition-colors disabled:opacity-50"
      >
        {saved ? '✓ Gespeichert' : saving ? '...' : 'Einstellungen speichern'}
      </button>
    </div>
  );
}
