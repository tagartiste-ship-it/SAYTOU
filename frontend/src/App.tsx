import { useEffect } from 'react';
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

// Layout
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const { isAuthenticated, fetchMe, logout } = useAuthStore();

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

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        
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
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      <Toaster position="top-right" richColors />
    </>
  );
}

export default App;
