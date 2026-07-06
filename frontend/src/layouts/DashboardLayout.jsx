import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, PlusCircle, ClipboardList, Map, Users, LogOut, User, Car, Wrench } from 'lucide-react';
import { getUser, clearSession, offlineStorage } from '../api/api';

export default function DashboardLayout({ children }) {
  const user = getUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [syncStatus, setSyncStatus] = useState('');

  useEffect(() => {
    const handleSync = async () => {
      if (navigator.onLine) {
        try {
          const pending = offlineStorage.getPendingVisits();
          if (pending.length > 0) {
            setSyncStatus('Sincronizando visitas locales guardadas sin conexión...');
            const count = await offlineStorage.syncPendingVisits((msg) => setSyncStatus(msg));
            if (count > 0) {
              setSyncStatus(`¡Sincronización exitosa! Se subieron ${count} visitas registradas offline.`);
              setTimeout(() => setSyncStatus(''), 4000);
            } else {
              setSyncStatus('');
            }
          }
        } catch (e) {
          console.error('Offline sync failed:', e);
          setSyncStatus('');
        }
      }
    };

    // Run sync on mount
    handleSync();

    // Listen to network status changes
    window.addEventListener('online', handleSync);
    return () => window.removeEventListener('online', handleSync);
  }, []);

  const handleLogout = () => {
    clearSession();
    navigate('/login');
  };

  if (!user) {
    return null;
  }

  const isAdmin = user.role === 'ADMIN';

  // Navigation config based on role
  const adminLinks = [
    { to: '/dashboard', label: 'Inicio', icon: Home },
    { to: '/mapa', label: 'Mapa Talleres', icon: Map },
    { to: '/vendedores', label: 'Vendedores', icon: Users },
    { to: '/talleres', label: 'Talleres', icon: Wrench },
  ];

  const vendedorLinks = [
    { to: '/dashboard', label: 'Inicio', icon: Home },
    { to: '/registrar-visita', label: 'Registrar Visita', icon: PlusCircle },
    { to: '/mis-visitas', label: 'Mis Visitas', icon: ClipboardList },
  ];

  const activeLinks = isAdmin ? adminLinks : vendedorLinks;

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'U';

  return (
    <div className="dashboard-container">
      {/* Mobile Top Header */}
      <header className="mobile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Car size={20} color="#3b82f6" />
          <span className="mobile-header-title">TallerVisitas Pro</span>
        </div>
        <button 
          onClick={handleLogout} 
          style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}
          title="Cerrar Sesión"
        >
          <LogOut size={20} />
        </button>
      </header>

      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <Car size={28} color="#3b82f6" />
          <span className="sidebar-logo-text">TallerVisitas Pro</span>
        </div>

        <nav className="sidebar-nav">
          {activeLinks.map((link) => {
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
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="user-profile-badge">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-role">{user.role}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="btn btn-secondary"
            style={{ padding: '10px 14px', width: '100%', fontSize: '0.9rem' }}
          >
            <LogOut size={16} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content" style={{ display: 'flex', flexDirection: 'column' }}>
        {syncStatus && (
          <div 
            className="alert alert-success" 
            style={{ 
              marginBottom: '20px', 
              borderRadius: 'var(--radius-sm)',
              justifyContent: 'center',
              fontWeight: '500',
              animation: 'fadeIn 0.3s'
            }}
          >
            <span>{syncStatus}</span>
          </div>
        )}
        <div style={{ flexGrow: 1 }}>
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-nav">
        {activeLinks.map((link) => {
          const LinkIcon = link.icon;
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
            >
              <LinkIcon size={22} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
