import React from 'react';
import { Car } from 'lucide-react';

export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="app-footer-inner">
        <div className="app-footer-brand">
          <Car size={14} />
          <span>TallerVisitas Pro</span>
        </div>
        <div className="app-footer-meta">
          <span>Ecuador</span>
          <span className="app-footer-sep">•</span>
          <span>{year}</span>
        </div>
      </div>
    </footer>
  );
}
