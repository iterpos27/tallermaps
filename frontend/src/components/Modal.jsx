import React from 'react';
import { X } from 'lucide-react';

export default function Modal({ children, onClose, labelledBy, maxWidth = '580px', showCloseButton = false }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose?.();
    }}>
      <div className="modal-panel glass-panel" role="dialog" aria-modal="true" aria-labelledby={labelledBy} style={{ maxWidth }}>
        {showCloseButton && (
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
