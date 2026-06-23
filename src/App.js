/**
 * App.js — Root component with routing and context providers.
 *
 * Provider hierarchy: Router → AuthProvider → SettingsProvider → Routes
 * ProtectedRoute: redirects to login if unauthenticated, to dashboard if non-admin.
 * adminOnly routes: Reports, Channels, Settings.
 */
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CheckIn from './pages/CheckIn';
import Reservations from './pages/Reservations';
import Rooms from './pages/Rooms';
import Payments from './pages/Payments';
import GuestSearch from './pages/GuestSearch';
import Reports from './pages/Reports';
import GuestFolio from './pages/GuestFolio';
import Housekeeping from './pages/Housekeeping';
import ChannelManager from './pages/ChannelManager';
import Settings from './pages/Settings';

function ProtectedRoute({ children, adminOnly }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400 text-sm">Loading...</p></div>;
  if (!user) return <Navigate to="/" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-400 text-sm">Loading...</p></div>;

  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/check-in" element={<ProtectedRoute><CheckIn /></ProtectedRoute>} />
      <Route path="/folio" element={<ProtectedRoute><GuestFolio /></ProtectedRoute>} />
      <Route path="/check-out" element={<ProtectedRoute><GuestFolio /></ProtectedRoute>} />
      <Route path="/reservations" element={<ProtectedRoute><Reservations /></ProtectedRoute>} />
      <Route path="/guests" element={<ProtectedRoute><GuestSearch /></ProtectedRoute>} />
      <Route path="/rooms" element={<ProtectedRoute><Rooms /></ProtectedRoute>} />
      <Route path="/housekeeping" element={<ProtectedRoute><Housekeeping /></ProtectedRoute>} />
      <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
      <Route path="/reports" element={<ProtectedRoute adminOnly><Reports /></ProtectedRoute>} />
      <Route path="/channels" element={<ProtectedRoute adminOnly><ChannelManager /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <SettingsProvider>
          <AppRoutes />
        </SettingsProvider>
      </AuthProvider>
    </Router>
  );
}
