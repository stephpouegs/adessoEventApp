import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api/client';

interface User { id: string; name: string; email: string; role: string; }
interface Location { id: string; name: string; city: string; address?: string; }
interface Stats { totalUsers: number; activeEvents: number; totalEvents: number; swipesToday: number; totalAttendances: number; }
interface AdminEvent {
  id: string; title: string; type: string; status: string; startDate: string;
  location: { name: string; city: string };
  organizer: { name: string };
  _count: { attendances: number };
}

const ROLES = ['USER', 'ORGANIZER', 'ADMIN'];
const EVENT_TYPE_EMOJI: Record<string, string> = {
  SPORT: '🏆', MEETING: '📋', LEISURE: '🎉', TRAINING: '🎓', COMPANY: '🏢', OTHER: '📌',
};
type Tab = 'stats' | 'users' | 'locations' | 'events';

export function AdminPanel() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('stats');
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [eventSearch, setEventSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [newLoc, setNewLoc] = useState({ name: '', city: '', address: '' });
  const [addingLoc, setAddingLoc] = useState(false);
  const [showLocForm, setShowLocForm] = useState(false);
  const [cancellingEvent, setCancellingEvent] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/users'),
      api.get('/admin/locations'),
      api.get('/admin/events'),
    ]).then(([s, u, l, e]) => {
      setStats(s.data);
      setUsers(u.data);
      setLocations(l.data);
      setEvents(e.data);
      setLoading(false);
    });
  }, []);

  const cancelEvent = async (eventId: string) => {
    if (!confirm('Event wirklich absagen?')) return;
    setCancellingEvent(eventId);
    try {
      await api.delete(`/events/${eventId}`);
      setEvents((prev) => prev.map((e) => e.id === eventId ? { ...e, status: 'CANCELLED' } : e));
    } finally {
      setCancellingEvent(null);
    }
  };

  const changeRole = async (userId: string, role: string) => {
    await api.put(`/admin/users/${userId}/role`, { role });
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role } : u));
  };

  const addLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingLoc(true);
    try {
      const res = await api.post('/admin/locations', newLoc);
      setLocations((prev) => [...prev, res.data]);
      setNewLoc({ name: '', city: '', address: '' });
      setShowLocForm(false);
    } finally {
      setAddingLoc(false);
    }
  };

  const deleteLocation = async (id: string) => {
    if (!confirm('Standort wirklich löschen?')) return;
    await api.delete(`/admin/locations/${id}`);
    setLocations((prev) => prev.filter((l) => l.id !== id));
  };

  const filtered = users.filter(
    (u) => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="flex justify-center pt-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0D3B6E]" /></div>;
  }

  const tabClass = (t: Tab) =>
    `flex-1 py-2 text-sm font-medium transition-colors ${tab === t ? 'text-[#0D3B6E] border-b-2 border-[#0D3B6E]' : 'text-gray-400'}`;

  return (
    <div className="max-w-lg mx-auto">
      {/* Tab-Navigation */}
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10 overflow-x-auto">
        <button className={tabClass('stats')} onClick={() => setTab('stats')}>Statistiken</button>
        <button className={tabClass('users')} onClick={() => setTab('users')}>{t('admin.users')}</button>
        <button className={tabClass('events')} onClick={() => setTab('events')}>{t('admin.events')}</button>
        <button className={tabClass('locations')} onClick={() => setTab('locations')}>{t('admin.locations')}</button>
      </div>

      <div className="px-4 py-5 space-y-4">

        {/* ── Statistiken ── */}
        {tab === 'stats' && stats && (
          <>
            <h2 className="text-lg font-bold text-gray-900">Systemstatistiken</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: '👥', label: 'Nutzer gesamt', value: stats.totalUsers },
                { icon: '📅', label: 'Aktive Events', value: stats.activeEvents },
                { icon: '👆', label: 'Swipes heute', value: stats.swipesToday },
                { icon: '✅', label: 'Teilnahmen', value: stats.totalAttendances },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
                  <div className="text-2xl mb-1">{s.icon}</div>
                  <div className="text-3xl font-bold text-[#0D3B6E]">{s.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Events gesamt</span><span className="font-semibold">{stats.totalEvents}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600 mb-2">
                <span>Davon aktiv</span><span className="font-semibold text-green-600">{stats.activeEvents}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Davon abgesagt</span><span className="font-semibold text-red-500">{stats.totalEvents - stats.activeEvents}</span>
              </div>
            </div>
          </>
        )}

        {/* ── Nutzerverwaltung ── */}
        {tab === 'users' && (
          <>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B6E]"
              placeholder={t('admin.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="space-y-2">
              {filtered.map((user) => (
                <div key={user.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#0D3B6E] text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <select
                    value={user.role}
                    onChange={(e) => changeRole(user.id, e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#0D3B6E] flex-shrink-0"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Event-Moderation ── */}
        {tab === 'events' && (
          <>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B6E]"
              placeholder="Titel oder Organisator suchen..."
              value={eventSearch}
              onChange={(e) => setEventSearch(e.target.value)}
            />
            <div className="flex gap-2 text-xs text-gray-500">
              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                {events.filter((e) => e.status === 'ACTIVE').length} aktiv
              </span>
              <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                {events.filter((e) => e.status === 'CANCELLED').length} abgesagt
              </span>
            </div>
            <div className="space-y-2">
              {events
                .filter((e) =>
                  e.title.toLowerCase().includes(eventSearch.toLowerCase()) ||
                  e.organizer.name.toLowerCase().includes(eventSearch.toLowerCase())
                )
                .map((event) => (
                  <div key={event.id} className={`bg-white rounded-xl border shadow-sm p-3 flex gap-3 items-start ${event.status === 'CANCELLED' ? 'opacity-50 border-red-100' : 'border-gray-100'}`}>
                    <span className="text-xl mt-0.5 flex-shrink-0">{EVENT_TYPE_EMOJI[event.type]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm text-gray-900 truncate">{event.title}</p>
                        {event.status === 'CANCELLED' && (
                          <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">Abgesagt</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        📅 {new Date(event.startDate).toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' })}
                        &nbsp;· 📍 {event.location.city}
                      </p>
                      <p className="text-xs text-gray-400">
                        von {event.organizer.name} · 👥 {event._count.attendances} Teilnehmer
                      </p>
                    </div>
                    {event.status === 'ACTIVE' && (
                      <button
                        onClick={() => cancelEvent(event.id)}
                        disabled={cancellingEvent === event.id}
                        className="text-xs text-red-500 border border-red-200 rounded-lg px-2 py-1 hover:bg-red-50 transition-colors disabled:opacity-40 flex-shrink-0"
                      >
                        {cancellingEvent === event.id ? '...' : 'Absagen'}
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </>
        )}

        {/* ── Standortverwaltung ── */}
        {tab === 'locations' && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">{locations.length} Standorte</span>
              <button
                onClick={() => setShowLocForm((v) => !v)}
                className="text-sm bg-[#0D3B6E] text-white px-3 py-1.5 rounded-lg hover:bg-[#1A6FBF] transition-colors"
              >
                + Hinzufügen
              </button>
            </div>

            {showLocForm && (
              <form onSubmit={addLocation} className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-200">
                <p className="text-sm font-semibold text-gray-700">Neuer Standort</p>
                <input
                  required placeholder="Name (z.B. adesso Stuttgart)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B6E]"
                  value={newLoc.name} onChange={(e) => setNewLoc({ ...newLoc, name: e.target.value })}
                />
                <input
                  required placeholder="Stadt"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B6E]"
                  value={newLoc.city} onChange={(e) => setNewLoc({ ...newLoc, city: e.target.value })}
                />
                <input
                  placeholder="Adresse (optional)"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0D3B6E]"
                  value={newLoc.address} onChange={(e) => setNewLoc({ ...newLoc, address: e.target.value })}
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={addingLoc}
                    className="flex-1 bg-[#0D3B6E] text-white text-sm py-2 rounded-lg hover:bg-[#1A6FBF] disabled:opacity-50"
                  >
                    {addingLoc ? '...' : 'Speichern'}
                  </button>
                  <button type="button" onClick={() => setShowLocForm(false)}
                    className="flex-1 border border-gray-300 text-gray-600 text-sm py-2 rounded-lg hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {locations.map((loc) => (
                <div key={loc.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex items-center gap-3">
                  <span className="text-xl">📍</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900">{loc.name}</p>
                    <p className="text-xs text-gray-500">{loc.city}{loc.address && ` · ${loc.address}`}</p>
                  </div>
                  <button
                    onClick={() => deleteLocation(loc.id)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
                  >
                    Löschen
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
