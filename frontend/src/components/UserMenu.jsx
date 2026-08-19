import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, User, Mail } from 'lucide-react';

const ROLE_LABELS = {
  ADMIN: 'Administrador',
  VENDEDOR: 'Vendedor',
  MENSAJERO: 'Mensajero',
};

export default function UserMenu({ user, variant = 'light' }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const initials = user.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'U';

  const roleLabel = ROLE_LABELS[user.role] || user.role;

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        type="button"
        className={`user-menu-trigger user-menu-trigger--${variant}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`Abrir perfil de ${user.name || 'usuario'}`}
      >
        <span className="user-menu-avatar">{initials}</span>
        <span className="user-menu-name">{user.name?.split(' ')[0]}</span>
        <ChevronDown size={16} className={`user-menu-chevron ${open ? 'open' : ''}`} />
      </button>

      {open && (
        <div className="user-menu-dropdown">
          <div className="user-menu-header">
            <div className="user-menu-header-avatar">{initials}</div>
            <div className="user-menu-header-info">
              <span className="user-menu-header-name">{user.name}</span>
              <span className="user-menu-header-role">{roleLabel}</span>
            </div>
          </div>

          {user.email && (
            <div className="user-menu-item user-menu-item--static">
              <Mail size={15} />
              <span>{user.email}</span>
            </div>
          )}

          <div className="user-menu-item user-menu-item--static">
            <User size={15} />
            <span>{user.username || user.email}</span>
          </div>
        </div>
      )}
    </div>
  );
}
