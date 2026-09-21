import React, { useEffect, useState } from 'react';
import { Calendar, ClipboardList, Search } from 'lucide-react';
import { api } from '../api/api';
import AlertBanner from '../components/AlertBanner';

export default function MisVisitas() {
  const [loading, setLoading] = useState(true);
  const [visitas, setVisitas] = useState([]);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const fetchVisitas = async () => {
    setLoading(true);
    try {
      const data = await api.visitas.list({
        search: searchTerm,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin
      });
      setVisitas(data);
    } catch (requestError) {
      setError(requestError.message || 'Error al cargar sus visitas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delay = setTimeout(fetchVisitas, 300);
    return () => clearTimeout(delay);
  }, [searchTerm, fechaInicio, fechaFin]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setFechaInicio('');
    setFechaFin('');
  };

  return (
    <div>
      <div className="page-header field-hero">
        <div>
          <h1 className="page-title">Mis visitas</h1>
          <p className="page-subtitle">Consulte sus visitas, fechas y observaciones en un solo lugar</p>
        </div>
      </div>

      <AlertBanner style={{ marginBottom: '20px' }}>{error}</AlertBanner>

      <div className="filter-bar glass-panel">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Buscar taller</label>
          <div className="input-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
            <input type="text" className="form-input" placeholder="Nombre del taller..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} style={{ paddingLeft: '40px' }} />
            <Search size={18} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
          </div>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Desde</label>
          <input type="date" className="form-input" value={fechaInicio} onChange={(event) => setFechaInicio(event.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Hasta</label>
          <input type="date" className="form-input" value={fechaFin} onChange={(event) => setFechaFin(event.target.value)} />
        </div>
        <button type="button" onClick={handleResetFilters} className="btn btn-secondary" style={{ height: '50px' }}>Limpiar</button>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner"></div><p>Cargando visitas...</p></div>
      ) : visitas.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <ClipboardList size={56} style={{ marginBottom: '16px', opacity: 0.4 }} />
          <h3>No se encontraron visitas</h3>
          <p style={{ marginTop: '8px' }}>Cambie los filtros o registre una nueva visita.</p>
        </div>
      ) : (
        <div className="glass-panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="premium-table visits-data-table">
            <thead>
              <tr>
                <th>Taller</th>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Observaciones</th>
              </tr>
            </thead>
            <tbody>
              {visitas.map((visita) => {
                const outsideGeofence = visita.fuera_rango === true;
                return (
                  <tr key={visita.id}>
                    <td><strong>{visita.taller_nombre}</strong></td>
                    <td>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap' }}>
                        <Calendar size={16} color="var(--primary)" />
                        {new Date(visita.fecha_visita).toLocaleDateString('es-EC')}
                      </div>
                    </td>
                    <td>
                      <span className={`visit-status-badge ${outsideGeofence ? 'outside' : 'completed'}`}>
                        {outsideGeofence ? 'FUERA DE GEOCERCA' : 'REALIZADA'}
                      </span>
                    </td>
                    <td>
                      <span className="visit-observation">{visita.observacion || 'Sin observaciones'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
