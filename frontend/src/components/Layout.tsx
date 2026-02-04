import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Calendar,
  CalendarCheck,
  Users,
  UserCog,
  Building2,
  Tags, 
  BarChart3, 
  UsersRound,
  Briefcase,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import ThemeToggle from './ThemeToggle';
import api from '../lib/api';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [hasNewBinomeCycle, setHasNewBinomeCycle] = useState(false);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;

    // Prevent window-level scroll. The app uses #app-scroll-container as the only scrollable area.
    // Some interactions (focus/label click) can still move window scroll, which looks like a black screen
    // because the page background is dark.
    const lockWindowScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    // Ensure window is at the top on navigation.
    lockWindowScroll();

    el.scrollTop = 0;
    requestAnimationFrame(() => {
      el.scrollTop = 0;
      requestAnimationFrame(() => {
        el.scrollTop = 0;
      });
    });

    const t1 = window.setTimeout(() => {
      el.scrollTop = 0;
    }, 0);
    const t2 = window.setTimeout(() => {
      el.scrollTop = 0;
    }, 50);

    let raf = 0;
    let t3 = 0;
    let t4 = 0;
    const clamp = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const maxY = Math.max(0, el.scrollHeight - el.clientHeight);
        if (el.scrollTop > maxY) el.scrollTop = maxY;
      });

      window.clearTimeout(t3);
      window.clearTimeout(t4);
      t3 = window.setTimeout(() => {
        const maxY = Math.max(0, el.scrollHeight - el.clientHeight);
        if (el.scrollTop > maxY) el.scrollTop = maxY;
      }, 150);
      t4 = window.setTimeout(() => {
        const maxY = Math.max(0, el.scrollHeight - el.clientHeight);
        if (el.scrollTop > maxY) el.scrollTop = maxY;
      }, 350);
    };

    const onResize = () => clamp();
    window.addEventListener('resize', onResize);

    window.addEventListener('scroll', lockWindowScroll, { passive: true });

    const onScroll = () => clamp();
    el.addEventListener('scroll', onScroll, { passive: true });

    const mo = new MutationObserver(() => clamp());
    mo.observe(el, { subtree: true, childList: true, characterData: true, attributes: true });

    clamp();

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', lockWindowScroll);
      el.removeEventListener('scroll', onScroll);
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [location.pathname]);

  useEffect(() => {
    const KEY = 'binomes:lastSeenCycleId';
    const check = async () => {
      try {
        const res = await api.get('/binomes/status');
        const cycle = res.data?.cycle;
        const lastSeen = localStorage.getItem(KEY);
        if (cycle?.id && cycle.id !== lastSeen) {
          setHasNewBinomeCycle(true);
        } else {
          setHasNewBinomeCycle(false);
        }
      } catch {
        // ignore
      }
    };

    void check();
    const t = window.setInterval(() => {
      void check();
    }, 60_000);

    return () => {
      window.clearInterval(t);
    };
  }, []);

  useEffect(() => {
    if (location.pathname !== '/binomes') return;
    const KEY = 'binomes:lastSeenCycleId';
    const markSeen = async () => {
      try {
        const res = await api.get('/binomes/status');
        const cycle = res.data?.cycle;
        if (cycle?.id) {
          localStorage.setItem(KEY, cycle.id);
        }
      } catch {
        // ignore
      } finally {
        setHasNewBinomeCycle(false);
      }
    };
    void markSeen();
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const baseNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Mes Rencontres', href: '/mes-rencontres', icon: CalendarCheck },
    { name: 'Historique', href: '/rencontres', icon: Calendar },
    { name: 'Membres', href: '/membres', icon: Users },
    { name: 'Bureau', href: '/bureau', icon: Briefcase },
    { name: 'Binômes', href: '/binomes', icon: UsersRound },
    { name: 'Utilisateurs', href: '/users', icon: UserCog, roles: ['LOCALITE', 'SOUS_LOCALITE_ADMIN'] },
    { name: 'Sous-Localités', href: '/sous-localites', icon: Building2, roles: ['LOCALITE'] },
    { name: 'Sections', href: '/sections', icon: Building2, roles: ['LOCALITE', 'SOUS_LOCALITE_ADMIN'] },
    { name: 'Types', href: '/types', icon: Tags },
    { name: 'Statistiques', href: '/stats', icon: BarChart3 },
    { name: 'Institutions', href: '/institutions', icon: Building2, roles: ['OWNER'] },
  ];

  // Filtrer la navigation selon le rôle de l'utilisateur
  const navigation = baseNavigation.filter(item => 
    user?.role === 'OWNER' || !item.roles || item.roles.includes(user?.role || '')
  );

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sidebar mobile */}
      <AnimatePresence>
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-900/50" 
              onClick={() => setSidebarOpen(false)} 
            />
            <motion.div 
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-900 shadow-xl"
            >
              <div className="flex h-full flex-col min-h-0">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-6 py-4">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">SAYTOU</h1>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                </button>
              </div>
              <nav className="flex-1 min-h-0 overflow-y-auto space-y-1 px-3 py-4">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      isActive(item.href)
                        ? 'bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg shadow-primary/25'
                        : `${
                            item.href === '/binomes' && hasNewBinomeCycle
                              ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 ring-2 ring-red-500 animate-pulse'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="flex items-center gap-2">
                      <span>{item.name}</span>
                      {item.href === '/binomes' && hasNewBinomeCycle && (
                        <span className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-red-600 text-white">
                          Nouveau
                        </span>
                      )}
                    </span>
                  </Link>
                ))}
              </nav>

              <div className="border-t border-gray-200 dark:border-gray-800 p-4">
                <div className="mb-3 rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
                  <p className="mt-1 text-xs font-medium text-primary dark:text-primary-400">
                    {user?.role === 'OWNER' && 'OWNER'}
                    {user?.role === 'LOCALITE' && 'Super Admin'}
                    {user?.role === 'SOUS_LOCALITE_ADMIN' && 'Admin Sous-Localité'}
                    {user?.role === 'SECTION_USER' && 'Utilisateur Section'}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSidebarOpen(false);
                    void handleLogout();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Déconnexion
                </button>
              </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sidebar desktop */}
      <div className="hidden w-64 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 lg:block">
        <div className="flex h-full flex-col">
          <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">SAYTOU</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Gestion de Rencontres</p>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  isActive(item.href)
                    ? 'bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg shadow-primary/25'
                    : `${
                        item.href === '/binomes' && hasNewBinomeCycle
                          ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 ring-2 ring-red-500 animate-pulse'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="flex items-center gap-2">
                  <span>{item.name}</span>
                  {item.href === '/binomes' && hasNewBinomeCycle && (
                    <span className="text-[10px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 bg-red-600 text-white">
                      Nouveau
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </nav>

          <div className="border-t border-gray-200 dark:border-gray-800 p-4">
            <div className="mb-3 flex items-center justify-between">
              <ThemeToggle />
            </div>
            <div className="mb-3 rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user?.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{user?.email}</p>
              <p className="mt-1 text-xs font-medium text-primary dark:text-primary-400">
                {user?.role === 'OWNER' && 'OWNER'}
                {user?.role === 'LOCALITE' && 'Super Admin'}
                {user?.role === 'SOUS_LOCALITE_ADMIN' && 'Admin Sous-Localité'}
                {user?.role === 'SECTION_USER' && 'Utilisateur Section'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Déconnexion
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header mobile */}
        <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Menu className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            </button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">SAYTOU</h1>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={() => void handleLogout()}
                className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                aria-label="Déconnexion"
                title="Déconnexion"
              >
                <LogOut className="h-5 w-5 text-red-600 dark:text-red-400" />
              </button>
            </div>
          </div>
        </header>

        <button
          onClick={() => void handleLogout()}
          className="fixed bottom-4 right-4 z-50 rounded-full bg-white dark:bg-gray-900 p-3 shadow-lg border border-gray-200 dark:border-gray-800 lg:hidden"
          aria-label="Déconnexion"
          title="Déconnexion"
        >
          <LogOut className="h-5 w-5 text-red-600 dark:text-red-400" />
        </button>

        {/* Page content */}
        <main ref={mainRef} id="app-scroll-container" className="flex-1 overflow-y-auto overscroll-none bg-gray-50 dark:bg-gray-950 p-4 pb-24 lg:p-8 lg:pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
