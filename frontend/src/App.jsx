import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getToken, getUser } from './api/api';

// Layouts
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import Login from './pages/Login';
import DashboardAdmin from './pages/DashboardAdmin';
import DashboardVendedor from './pages/DashboardVendedor';
import RegistrarVisita from './pages/RegistrarVisita';
import MisVisitas from './pages/MisVisitas';
import MapaTalleres from './pages/MapaTalleres';
import GestionVendedores from './pages/GestionVendedores';
import GestionTalleres from './pages/GestionTalleres';

/**
 * Route Guard for authenticated users
 */
function ProtectedRoute({ children, allowedRoles }) {
  const token = getToken();
  const user = getUser();

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

/**
 * Main Dashboard Router
 * Decides whether to render Admin or Vendedor dashboard based on role
 */
function CentralDashboard() {
  const user = getUser();
  
  if (user?.role === 'ADMIN') {
    return <DashboardAdmin />;
  }
  
  return <DashboardVendedor />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected Dashboard Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <CentralDashboard />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Vendor-Only Routes */}
        <Route
          path="/registrar-visita"
          element={
            <ProtectedRoute allowedRoles={['VENDEDOR']}>
              <DashboardLayout>
                <RegistrarVisita />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/mis-visitas"
          element={
            <ProtectedRoute allowedRoles={['VENDEDOR']}>
              <DashboardLayout>
                <MisVisitas />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Admin-Only Routes */}
        <Route
          path="/mapa"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <DashboardLayout>
                <MapaTalleres />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/vendedores"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <DashboardLayout>
                <GestionVendedores />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/talleres"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <DashboardLayout>
                <GestionTalleres />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
