import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, PlusCircle, ClipboardList, Map, Users, Car, Wrench,
  CalendarDays, Activity, CloudOff, Truck, Warehouse, MoreHorizontal, X, LogOut, MapPinned, Route,
} from 'lucide-react';
import { api, getUser, clearSession, offlineStorage } from '../api/api';
import MessengerTracker from '../components/MessengerTracker';
import UserMenu from '../components/UserMenu';
import AppFooter from '../components/AppFooter';
import SidebarNavGroup from '../components/SidebarNavGroup';

const adminGroups = [
  {
    label: 'General',
    links: [
      { to: '/dashboard', label: 'Inicio', mobileLabel: 'Inicio', icon: Home },
      { to: '/programacion', label: 'Programación', mobileLabel: 'Agenda', icon: CalendarDays },
      { to: '/reportes', label: 'Reportes', icon: ClipboardList },
      { to: '/seguimiento', label: 'Seguimiento', icon: CalendarDays },
      { to: '/mapa', label: 'Mapa y rutas', mobileLabel: 'Mapa', icon: Map },
    ],
  },
  {
    label: 'Administración',
    links: [
      { to: '/usuarios', label: 'Usuarios', mobileLabel: 'Usuarios', icon: Users },
      { to: '/talleres', label: 'Talleres', icon: Wrench },
      { to: '/almacenes', label: 'Almacenes', icon: Warehouse },
      { to: '/sectores', label: 'Sectores', icon: MapPinned },
    ],
  },
  {
    label: 'Operaciones',
    links: [
      { to: '/actividad', label: 'Actividad', icon: Activity },
      { to: '/control-entregas', label: 'Entregas', icon: Truck },
    ],
  },
];

const adminLinks = adminGroups.flatMap((g) => g.links);

const vendedorLinks = [
  { to: '/seguimiento', label: 'Seguimiento', icon: CalendarDays },
  { to: '/dashboard', label: 'Inicio', mobileLabel: 'Inicio', icon: Home },
  { to: '/mi-ruta', label: 'Mi ruta de hoy', mobileLabel: 'Mi ruta', icon: Route },
  { to: '/programar-visitas', label: 'Programar', mobileLabel: 'Agenda', icon: CalendarDays },
  { to: '/registrar-visita', label: 'Registrar Visita', mobileLabel: 'Registrar', icon: PlusCircle, emphasis: true },
  { to: '/mis-visitas', label: 'Mis Visitas', mobileLabel: 'Visitas', icon: ClipboardList },
  { to: '/visitas-offline', label: 'Pendientes Offline', mobileLabel: 'Pendientes', icon: CloudOff },
  { to: '/mapa', label: 'Mapa y rutas', mobileLabel: 'Mapa', icon: Map },
];

const mensajeroLinks = [
  { to: '/dashboard', label: 'Entrega', icon: Truck },
];

const MOBILE_PRIMARY_COUNT = 5;

function AccountActions({ user, onLogout, variant }) {
  return (
    <div className={`account-actions account-actions--${variant}`}>
      <UserMenu user={user} variant={variant} />
      <button
        type="button"
        className={`logout-button logout-button--${variant}`}
        onClick={onLogout}
        aria-label="Cerrar sesión"
        title="Cerrar sesión"
      >
        <LogOut size={18} />
        <span>Salir</span>
      </button>
    </div>
  );
}

function getMobileNavSplit(links) {
  if (links.length <= MOBILE_PRIMARY_COUNT) {
    return { primary: links, secondary: [] };
  }
  return {
    primary: links.slice(0, MOBILE_PRIMARY_COUNT - 1),
    secondary: links.slice(MOBILE_PRIMARY_COUNT - 1),
  };
}

export default function DashboardLayout({ children }) {
  const user = getUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [syncStatus, setSyncStatus] = useState('');
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef(null);
  const syncRunningRef = useRef(false);

  useEffect(() => {
    const handleSync = async () => {
      if (navigator.onLine && !syncRunningRef.current) {
        syncRunningRef.current = true;
        try {
          const pending = await offlineStorage.getPendingVisits();
          if (pending.length > 0) {
            setSyncStatus('Sincronizando visitas locales guardadas sin conexión...');
            const { syncedCount, conflictCount } = await offlineStorage.syncPendingVisits((msg) => setSyncStatus(msg));
            if (conflictCount > 0) {
              setSyncStatus(`${conflictCount} visita(s) offline requieren revisión. Los datos permanecen guardados en este dispositivo.`);
            } else if (syncedCount > 0) {
              setSyncStatus(`¡Sincronización exitosa! Se subieron ${syncedCount} visitas registradas offline.`);
              setTimeout(() => setSyncStatus(''), 4000);
            } else {
              setSyncStatus('');
            }
          }
        } catch (e) {
          console.error('Offline sync failed:', e);
          setSyncStatus('No se pudo sincronizar. Se reintentará automáticamente.');
        } finally {
          syncRunningRef.current = false;
        }
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      setSyncStatus('Conexión recuperada. Revisando visitas pendientes...');
      handleSync();
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncStatus('Sin conexión. Las nuevas visitas se guardarán en este dispositivo.');
    };

    if (!navigator.onLine) handleOffline();
    handleSync();
    const intervalId = window.setInterval(handleSync, 60 * 1000);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    setMoreMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Clear the local view of the session even if the network is unavailable.
    }
    clearSession();
    navigate('/login');
  };

  if (!user) return null;

  const isAdmin = user.role === 'ADMIN';
  const activeLinks = isAdmin ? adminLinks : (user.role === 'MENSAJERO' ? mensajeroLinks : vendedorLinks);
  const { primary: mobilePrimary, secondary: mobileSecondary } = getMobileNavSplit(activeLinks);
  const hasMoreMenu = mobileSecondary.length > 0;
  const isMoreActive = mobileSecondary.some((l) => location.pathname === l.to);

  const currentPage = activeLinks.find((l) => l.to === location.pathname);

  return (
    <div className="dashboard-container">
      {/* Mobile Top Header */}
      <header className="mobile-header">
        <div className="mobile-header-brand">
          <Car size={20} />
          <span className="mobile-header-title">TallerVisitas Pro</span>
        </div>
        <AccountActions user={user} onLogout={handleLogout} variant="dark" />
      </header>

      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Car size={28} />
          <span className="sidebar-logo-text">TallerVisitas Pro</span>
        </div>

        <nav className="sidebar-nav">
          {isAdmin ? (
            adminGroups.map((group) => (
              <SidebarNavGroup
                key={group.label}
                label={group.label}
                links={group.links}
              />
            ))
          ) : (
            activeLinks.map((link) => {
              const LinkIcon = link.icon;
              const isActive = location.pathname === link.to;
              return (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                >
                  <LinkIcon size={20} />
                  <span>{link.label}</span>
                </Link>
              );
            })
          )}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="main-wrapper">
        {/* Desktop Top Bar */}
        <header className="app-topbar">
          <div className="app-topbar-left">
            {currentPage && (
              <span className="app-topbar-breadcrumb">{currentPage.label}</span>
            )}
          </div>
          <div className="app-topbar-right">
            <AccountActions user={user} onLogout={handleLogout} variant="light" />
          </div>
        </header>

        <main className="main-content">
          {user.role === 'MENSAJERO' && <MessengerTracker />}
          {syncStatus && (
            <div className={`alert ${isOnline ? 'alert-success' : 'alert-danger'} sync-banner`} role="status">
              <span>{syncStatus}</span>
            </div>
          )}
          <div className="main-content-body">
            {children}
          </div>
          <AppFooter />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav">
        {mobilePrimary.map((link) => {
          const LinkIcon = link.icon;
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`mobile-nav-item ${link.emphasis ? 'mobile-nav-item--primary' : ''} ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="mobile-nav-icon"><LinkIcon size={21} /></span>
              <span className="mobile-nav-label">{link.mobileLabel || link.label}</span>
            </Link>
          );
        })}

        {hasMoreMenu && (
          <div className="mobile-nav-more" ref={moreMenuRef}>
            <button
              type="button"
              className={`mobile-nav-item mobile-nav-more-btn ${isMoreActive ? 'active' : ''}`}
              onClick={() => setMoreMenuOpen((v) => !v)}
              aria-expanded={moreMenuOpen}
              aria-haspopup="dialog"
            >
              <span className="mobile-nav-icon"><MoreHorizontal size={21} /></span>
              <span className="mobile-nav-label">Más</span>
            </button>

            {moreMenuOpen && (
              <>
                <button
                  type="button"
                  className="mobile-more-backdrop"
                  onClick={() => setMoreMenuOpen(false)}
                  aria-label="Cerrar más opciones"
                />
                <div className="mobile-more-sheet" role="dialog" aria-label="Más opciones de navegación">
                  <div className="mobile-more-sheet-header">
                    <span>Más opciones</span>
                    <button type="button" className="mobile-more-close" onClick={() => setMoreMenuOpen(false)} aria-label="Cerrar">
                      <X size={20} />
                    </button>
                  </div>
                  <div className="mobile-more-sheet-links">
                    {mobileSecondary.map((link) => {
                      const LinkIcon = link.icon;
                      const isActive = location.pathname === link.to;
                      return (
                        <Link
                          key={link.to}
                          to={link.to}
                          className={`mobile-more-link ${isActive ? 'active' : ''}`}
                          onClick={() => setMoreMenuOpen(false)}
                        >
                          <LinkIcon size={20} />
                          <span>{link.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </nav>
    </div>
  );
}
