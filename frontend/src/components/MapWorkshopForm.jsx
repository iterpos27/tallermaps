import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import Modal from './Modal';

export default function MapWorkshopForm({
  position,
  name,
  onNameChange,
  sectorId,
  onSectorChange,
  sectors,
  error,
  saving,
  onClose,
  onSubmit
}) {
  const errorRef = useRef(null);
  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
      errorRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [error]);
  if (!position) return null;

  return (
    <Modal onClose={onClose} labelledBy="new-map-workshop-title" maxWidth="520px">
      <form onSubmit={onSubmit}>
        <div className="modal-heading-row">
          <div>
            <h3 id="new-map-workshop-title" className="modal-title">Nuevo taller</h3>
            <p className="modal-subtitle">Ubicación seleccionada desde el mapa. Debe estar a más de 50 metros de otro taller registrado.</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} disabled={saving} aria-label="Cerrar">
            <X size={20} />
          </button>
        </div>

        {error && <div ref={errorRef} role="alert" tabIndex={-1} className="alert alert-danger" style={{ marginBottom: '16px' }}>{error}</div>}

        <div className="form-group">
          <label className="form-label" htmlFor="new-map-workshop-name">Nombre del taller</label>
          <input id="new-map-workshop-name" className="form-input" value={name} onChange={onNameChange} placeholder="Ej. Taller Mecánico Central" autoFocus disabled={saving} />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="new-map-workshop-sector">Sector</label>
          <select id="new-map-workshop-sector" className="form-input form-select" value={sectorId} onChange={onSectorChange} disabled={saving}>
            <option value="">Sin sector</option>
            {sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.nombre}</option>)}
          </select>
        </div>

        <div className="coordinate-grid">
          <div className="form-group">
            <label className="form-label">Latitud</label>
            <input className="form-input" value={position.lat.toFixed(6)} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Longitud</label>
            <input className="form-input" value={position.lng.toFixed(6)} readOnly />
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Volver al mapa</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar taller'}</button>
        </div>
      </form>
    </Modal>
  );
}
