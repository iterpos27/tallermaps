import { can, canVisit } from './utils/permissions';
import { useLocation } from 'react-router-dom';
import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { hasSession, getUser } from './api/api';

// Layouts
import DashboardLayout from './layouts/DashboardLayout';

// Pages
import Login from './pages/Login';
import DashboardAdmin from './pages/DashboardAdmin';
import DashboardVendedor from './pages/DashboardVendedor';
import RegistrarVisita from './pages/RegistrarVisita';
import ProgramarVisitas from './pages/ProgramarVisitas';
import MisVisitas from './pages/MisVisitas';
import GestionVendedores from './pages/GestionVendedores';
import GestionTalleres from './pages/GestionTalleres';
import GestionAlmacenes from './pages/GestionAlmacenes';
import ProgramacionAdmin from './pages/ProgramacionAdmin';
import ActividadAdmin from './pages/ActividadAdmin';
import VisitasOffline from './pages/VisitasOffline';
import EntregasMensajero from './pages/EntregasMensajero';
import ControlEntregas from './pages/ControlEntregas';
import GestionSectores from './pages/GestionSectores';
const Reportes = lazy(() => import('./pages/Reportes'));
const Seguimiento = lazy(() => import('./pages/Seguimiento'));

const MapaTalleres = lazy(() => import('./pages/MapaTalleres'));
const MiRutaHoy = lazy(() => import('./pages/MiRutaHoy'));

/**
 * Route Guard for authenticated users
 */
function ProtectedRoute({ children, allowedRoles }) {
  const { pathname } = useLocation();
  const sessionAvailable = hasSession();
  const user = getUser();

  if (!sessionAvailable || !user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!canVisit(user, pathname)) return <Navigate to="/dashboard" replace />;
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
  if (user?.role === 'MENSAJERO') {
    return can(user, 'delivery') ? <EntregasMensajero /> : <div className="glass-panel permission-empty"><h1>Bienvenido, {user.name}</h1><p>El administrador todavía no ha habilitado opciones para su usuario.</p></div>;
  }
  
  return <DashboardVendedor />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="loading-overlay"><div className="spinner" /><p>Cargando módulo...</p></div>}>
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
          path="/mi-ruta"
          element={
            <ProtectedRoute allowedRoles={['VENDEDOR']}>
              <DashboardLayout>
                <MiRutaHoy />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
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
          path="/programar-visitas"
          element={
            <ProtectedRoute allowedRoles={['VENDEDOR']}>
              <DashboardLayout>
                <ProgramarVisitas />
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
        <Route
          path="/visitas-offline"
          element={
            <ProtectedRoute allowedRoles={['VENDEDOR']}>
              <DashboardLayout>
                <VisitasOffline />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Admin-Only Routes */}
        <Route path="/seguimiento" element={<ProtectedRoute allowedRoles={['ADMIN']}><DashboardLayout><Seguimiento /></DashboardLayout></ProtectedRoute>} />
        <Route path="/reportes" element={<ProtectedRoute allowedRoles={['ADMIN']}><DashboardLayout><Reportes /></DashboardLayout></ProtectedRoute>} />
        <Route
          path="/entregas"
          element={
            <ProtectedRoute allowedRoles={['MENSAJERO']}>
              <DashboardLayout><EntregasMensajero /></DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/control-entregas"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <DashboardLayout><ControlEntregas /></DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/programacion"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <DashboardLayout>
                <ProgramacionAdmin />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/mapa"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'VENDEDOR']}>
              <DashboardLayout>
                <MapaTalleres />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/usuarios"
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
        <Route path="/vendedores" element={<Navigate to="/usuarios" replace />} />

        <Route
          path="/almacenes"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <DashboardLayout>
                <GestionAlmacenes />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/sectores"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <DashboardLayout><GestionSectores /></DashboardLayout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/actividad"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <DashboardLayout>
                <ActividadAdmin />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
