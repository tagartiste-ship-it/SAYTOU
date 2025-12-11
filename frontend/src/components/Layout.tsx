import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  Calendar,
  CalendarCheck,
  Users,
  Building2,
  Tags, 
  BarChart3, 
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import ThemeToggle from './ThemeToggle';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const baseNavigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Mes Rencontres', href: '/mes-rencontres', icon: CalendarCheck },
    { name: 'Historique', href: '/rencontres', icon: Calendar },
    { name: 'Membres', href: '/membres', icon: Users },
    { name: 'Sous-Localités', href: '/sous-localites', icon: Building2, roles: ['LOCALITE'] },
    { name: 'Sections', href: '/sections', icon: Building2, roles: ['LOCALITE', 'SOUS_LOCALITE_ADMIN'] },
    { name: 'Types', href: '/types', icon: Tags },
    { name: 'Statistiques', href: '/stats', icon: BarChart3 },
  ];

  // Filtrer la navigation selon le rôle de l'utilisateur
  const navigation = baseNavigation.filter(item => 
    !item.roles || item.roles.includes(user?.role || '')
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
              <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-6 py-4">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">SAYTOU</h1>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                </button>
              </div>
              <nav className="flex-1 space-y-1 px-3 py-4">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                      isActive(item.href)
                        ? 'bg-gradient-to-r from-primary to-primary/90 text-white shadow-lg shadow-primary/25'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                ))}
              </nav>
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
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
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
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-950 p-4 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
