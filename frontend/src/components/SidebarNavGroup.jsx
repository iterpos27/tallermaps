import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

export default function SidebarNavGroup({ label, links, defaultOpen = false }) {
  const location = useLocation();
  const hasActive = links.some((l) => location.pathname === l.to);
  const [open, setOpen] = useState(defaultOpen || hasActive);

  return (
    <div className={`sidebar-nav-group ${open ? 'open' : ''}`}>
      <button
        type="button"
        className="sidebar-nav-group-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown size={16} className="sidebar-nav-group-chevron" />
      </button>
      <div className="sidebar-nav-group-items">
        {links.map((link) => {
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
      </div>
    </div>
  );
}
