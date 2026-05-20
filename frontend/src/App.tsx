import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from './store/auth';
import api from './api/client';
import { EventFeed } from './components/EventFeed/EventFeed';
import { MyEvents } from './pages/MyEvents';
import { EventForm } from './components/EventForm/EventForm';
import { AdminPanel } from './components/AdminPanel/AdminPanel';
import { LocationPicker } from './components/Onboarding/LocationPicker';
import { Profile } from './pages/Profile';
import { OrganizerDashboard } from './pages/OrganizerDashboard';
import './i18n/config';

type Tab = 'feed' | 'myEvents' | 'create' | 'admin' | 'profile';

export default function App() {
  const { t, i18n } = useTranslation();
  const { user, token, logout, setUser } = useAuthStore();
  const [tab, setTab] = useState<Tab>('feed');

  if (!token || !user) return <LoginScreen />;

  if (!user.locationId) {
    return (
      <LocationPicker
        onComplete={(locationId) => setUser({ ...user, locationId })}
      />
    );
  }

  const navItems = [
    { id: 'feed', label: t('nav.feed'), icon: '🏠' },
    { id: 'myEvents', label: t('nav.myEvents'), icon: '📋' },
    ...(user.role === 'ORGANIZER' || user.role === 'ADMIN' ? [{ id: 'create', label: 'Events', icon: '📁' }] : []),
    ...(user.role === 'ADMIN' ? [{ id: 'admin', label: 'Admin', icon: '⚙️' }] : []),
    { id: 'profile', label: 'Profil', icon: '👤' },
  ] as { id: Tab; label: string; icon: string }[];

  return (
    <div className="min-h-screen bg-[#F0F4F8] flex flex-col w-full max-w-lg mx-auto">
      <header className="bg-[#0D3B6E] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg">adesso</span>
          <span className="text-[#7BAFD4] font-bold text-lg">EventApp</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => i18n.changeLanguage(i18n.language === 'de' ? 'en' : 'de')}
            className="text-xs bg-white/20 hover:bg-white/30 px-2 py-1 rounded-full transition-colors"
          >
            {i18n.language === 'de' ? 'EN' : 'DE'}
          </button>
          <button onClick={() => { setTab('feed'); logout(); }} className="text-xs text-white/70 hover:text-white transition-colors">
            {t('auth.logout')}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {tab === 'feed' && <EventFeed />}
        {tab === 'myEvents' && <MyEvents />}
        {tab === 'create' && (user.role === 'ORGANIZER' || user.role === 'ADMIN') && <OrganizerDashboard />}
        {tab === 'admin' && <AdminPanel />}
        {tab === 'profile' && <Profile />}
      </main>

      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg bg-white border-t border-gray-200 flex justify-between px-4 py-2 z-50">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-lg transition-colors ${tab === item.id ? 'text-[#0D3B6E]' : 'text-gray-400'}`}
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

const TEST_ACCOUNTS = [
  { email: 'demo@adesso.de', name: 'Demo User', label: 'User' },
  { email: 'organizer@adesso.de', name: 'Organizer', label: 'Organizer' },
  { email: 'admin@adesso.de', name: 'Admin', label: 'Admin' },
];

function LoginScreen() {
  const { t } = useTranslation();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState('demo@adesso.de');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const name = TEST_ACCOUNTS.find((a) => a.email === email)?.name ?? email.split('@')[0];
      const res = await api.post('/auth/callback', { email, name });
      if (res.data.accessToken) setAuth(res.data.accessToken, res.data.user);
    } catch {
      setError('Anmeldung fehlgeschlagen. Nur @adesso.de E-Mails erlaubt.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D3B6E] flex flex-col items-center justify-center px-6 text-white">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-1">adesso<span className="text-[#7BAFD4]">EventApp</span></h1>
        <p className="text-white/70 text-lg">{t('app.tagline')}</p>
      </div>

      <form onSubmit={handleLogin} className="bg-white/10 rounded-2xl p-6 w-full max-w-sm backdrop-blur-sm space-y-4">
        <div>
          <label className="text-sm text-white/70 mb-1 block">E-Mail</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-white text-gray-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-white/50"
            placeholder="name@adesso.de"
          />
        </div>

        {error && <p className="text-red-300 text-xs">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-white text-[#0D3B6E] font-bold py-3 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-60"
        >
          {loading ? '...' : `${t('auth.login')} →`}
        </button>

        <div>
          <p className="text-white/50 text-xs text-center mb-2">Test-Accounts</p>
          <div className="flex gap-2 justify-center">
            {TEST_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => setEmail(a.email)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors border ${
                  email === a.email
                    ? 'bg-white text-[#0D3B6E] border-white font-semibold'
                    : 'bg-white/10 text-white/80 border-white/20 hover:bg-white/20'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
