import { useEffect, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { useAuthStore } from './store/authStore';

// Pages
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import RencontresPage from './pages/RencontresPage';
import MesRencontresPage from './pages/MesRencontresPage';
import RencontreDetailPage from './pages/RencontreDetailPage';
import CreateRencontrePage from './pages/CreateRencontrePage';
import EditRencontrePage from './pages/EditRencontrePage';
import MembresPage from './pages/MembresPage';
import SousLocalitesPage from './pages/SousLocalitesPage';
import SectionsPage from './pages/SectionsPage';
import TypesPage from './pages/TypesPage';
import StatsPage from './pages/StatsPage';
import UsersPage from './pages/UsersPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import BinomesPage from './pages/BinomesPage';
import PrintRencontrePage from './pages/PrintRencontrePage';
import BureauPage from './pages/BureauPage';
import InstitutionsPage from './pages/InstitutionsPage';
import MonInstitutionPage from './pages/MonInstitutionPage';
import CellulesPage from './pages/CellulesPage';
import CommissionsPage from './pages/CommissionsPage';
import PvCellulesPage from './pages/PvCellulesPage';

// Layout
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const { isAuthenticated, fetchMe, logout } = useAuthStore();

  const lastFetchMeAtRef = useRef<number>(0);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchMe();
      return;
    }

    if (isAuthenticated) {
      logout();
    }
  }, [isAuthenticated, fetchMe, logout]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const IDLE_MS = 10 * 60 * 1000;
    const STORAGE_KEY = 'saytou:lastActivityAt';

    const markActivity = () => {
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
      }
    };

    const checkIdle = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      let last = Date.now();
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw && !Number.isNaN(Number(raw))) last = Number(raw);
      } catch {
      }

      if (Date.now() - last >= IDLE_MS) {
        await logout();
        return;
      }
    };

    const maybeRefetchMe = () => {
      const token = localStorage.getItem('accessToken');
      if (!token) return;
      const now = Date.now();
      if (now - lastFetchMeAtRef.current < 30_000) return;
      lastFetchMeAtRef.current = now;
      fetchMe();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkIdle().then(() => {
          if (localStorage.getItem('accessToken')) maybeRefetchMe();
        });
      }
    };

    const onFocus = () => {
      void checkIdle().then(() => {
        if (localStorage.getItem('accessToken')) maybeRefetchMe();
      });
    };

    markActivity();

    const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    for (const e of events) window.addEventListener(e, markActivity, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onFocus);

    const interval = window.setInterval(() => {
      void checkIdle();
    }, 30_000);

    return () => {
      for (const e of events) window.removeEventListener(e, markActivity);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onFocus);
      window.clearInterval(interval);
    };
  }, [fetchMe, isAuthenticated, logout]);

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/rencontres/:id/print"
          element={
            <ProtectedRoute>
              <PrintRencontrePage />
            </ProtectedRoute>
          }
        />
        
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="mes-rencontres" element={<MesRencontresPage />} />
          <Route path="rencontres" element={<RencontresPage />} />
          <Route path="rencontres/new" element={<CreateRencontrePage />} />
          <Route path="rencontres/:id/edit" element={<EditRencontrePage />} />
          <Route path="rencontres/:id" element={<RencontreDetailPage />} />
          <Route path="membres" element={<MembresPage />} />
          <Route path="sous-localites" element={<SousLocalitesPage />} />
          <Route path="sections" element={<SectionsPage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="change-password" element={<ChangePasswordPage />} />
          <Route path="types" element={<TypesPage />} />
          <Route path="stats" element={<StatsPage />} />
          <Route path="binomes" element={<BinomesPage />} />
          <Route path="bureau" element={<BureauPage />} />
          <Route path="institutions" element={<InstitutionsPage />} />
          <Route path="pv-cellules" element={<PvCellulesPage />} />
          <Route path="mon-institution" element={<MonInstitutionPage />} />
          <Route path="cellules" element={<CellulesPage />} />
          <Route path="commissions" element={<CommissionsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      <Toaster position="top-right" richColors />
    </>
  );
}

export default App;
