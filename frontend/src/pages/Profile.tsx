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
  const { user, setUser, token } = useAuthStore();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLoc, setSelectedLoc] = useState(user?.locationId ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiOptIn, setAiOptIn] = useState(true);
  const [businessLine, setBusinessLine] = useState((user as any)?.businessLine ?? '');
  const [competenceCenter, setCompetenceCenter] = useState((user as any)?.competenceCenter ?? '');
  const [msConnected, setMsConnected] = useState(false);
  const [msDisconnecting, setMsDisconnecting] = useState(false);
  const [msNotice, setMsNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    api.get('/admin/locations').then((r) => setLocations(r.data));
    api.get('/microsoft/status').then((r) => setMsConnected(r.data.connected)).catch(() => {});
  }, []);

  // Handle redirect back from Microsoft OAuth (params in URL after callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const msConnectedParam = params.get('ms_connected');
    const msErrorParam = params.get('ms_error');

    if (msConnectedParam === 'true') {
      setMsConnected(true);
      setMsNotice({ type: 'success', text: 'Microsoft-Konto erfolgreich verbunden. Events werden ab jetzt automatisch in deinen Outlook-Kalender eingetragen.' });
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setMsNotice(null), 6000);
    } else if (msErrorParam) {
      setMsNotice({ type: 'error', text: 'Verbindung mit Microsoft fehlgeschlagen. Bitte versuche es erneut.' });
      window.history.replaceState({}, '', window.location.pathname);
      setTimeout(() => setMsNotice(null), 6000);
    }
  }, []);

  const connectMicrosoft = () => {
    const apiBase = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';
    window.location.href = `${apiBase}/microsoft/connect?token=${encodeURIComponent(token ?? '')}`;
  };

  const disconnectMicrosoft = async () => {
    setMsDisconnecting(true);
    try {
      await api.delete('/microsoft/disconnect');
      setMsConnected(false);
      setMsNotice({ type: 'success', text: 'Microsoft-Konto getrennt.' });
      setTimeout(() => setMsNotice(null), 3000);
    } finally {
      setMsDisconnecting(false);
    }
  };

  const currentLocation = locations.find((l) => l.id === selectedLoc);

  const saveSettings = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await Promise.all([
        api.put('/user/location', { locationId: selectedLoc }),
        api.put('/user/settings', { language: i18n.language, aiOptIn, businessLine, competenceCenter }),
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

      {/* Business Line & CC */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
        <h2 className="font-semibold text-gray-800">Organisationseinheit</h2>
        <p className="text-xs text-gray-500">Wird verwendet, um relevante Events für deine Business Line oder dein Competence Center anzuzeigen.</p>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">🏢 Business Line</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B6E]"
            placeholder="z.B. Digital Experience"
            value={businessLine}
            onChange={(e) => setBusinessLine(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">🎓 Competence Center</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B6E]"
            placeholder="z.B. Cloud & Infrastructure"
            value={competenceCenter}
            onChange={(e) => setCompetenceCenter(e.target.value)}
          />
        </div>
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

      {/* Microsoft / Outlook-Kalender */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
            <rect x="12" y="1" width="10" height="10" fill="#7FBA00"/>
            <rect x="1" y="12" width="10" height="10" fill="#00A4EF"/>
            <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
          </svg>
          <h2 className="font-semibold text-gray-800">Microsoft Outlook-Kalender</h2>
        </div>
        <p className="text-xs text-gray-500">
          Events, denen du per Swipe-Right zusagst, werden automatisch in deinen Outlook-Kalender eingetragen.
        </p>

        {msNotice && (
          <div className={`text-xs rounded-lg px-3 py-2 ${msNotice.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {msNotice.text}
          </div>
        )}

        {msConnected ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              <span className="text-green-500">✓</span>
              <span className="font-medium">Mit Microsoft verbunden</span>
            </div>
            <button
              onClick={disconnectMicrosoft}
              disabled={msDisconnecting}
              className="w-full border border-gray-300 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {msDisconnecting ? '...' : 'Verbindung trennen'}
            </button>
          </div>
        ) : (
          <button
            onClick={connectMicrosoft}
            className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 23 23" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
              <rect x="12" y="1" width="10" height="10" fill="#7FBA00"/>
              <rect x="1" y="12" width="10" height="10" fill="#00A4EF"/>
              <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
            </svg>
            Mit Microsoft verbinden
          </button>
        )}
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
