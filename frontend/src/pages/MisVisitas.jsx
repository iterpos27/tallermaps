import React, { useState, useEffect } from 'react';
import { ClipboardList, Search, Calendar, MapPin, ExternalLink, X, FileText } from 'lucide-react';
import { api, API_BASE_URL } from '../api/api';

export default function MisVisitas() {
  const [loading, setLoading] = useState(true);
  const [visitas, setVisitas] = useState([]);
  const [error, setError] = useState('');
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  
  // Selected photo modal
  const [activePhoto, setActivePhoto] = useState(null);

  const fetchVisitas = async () => {
    setLoading(true);
    try {
      const data = await api.visitas.list({
        search: searchTerm,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin
      });
      setVisitas(data);
    } catch (err) {
      setError('Error al cargar sus visitas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounced search on search term change
    const delayDebounceFn = setTimeout(() => {
      fetchVisitas();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, fechaInicio, fechaFin]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setFechaInicio('');
    setFechaFin('');
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mis Visitas Registradas</h1>
          <p className="page-subtitle">Consulte su historial de visitas en campo</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
          <span>{error}</span>
        </div>
      )}

      {/* Filters Bar */}
      <div className="filter-bar glass-panel">
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Buscar Taller</label>
          <div className="input-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Nombre del taller..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '40px' }}
            />
            <Search size={18} style={{ position: 'absolute', left: '14px', color: 'var(--text-muted)' }} />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Desde</label>
          <input
            type="date"
            className="form-input"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Hasta</label>
          <input
            type="date"
            className="form-input"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
          />
        </div>

        <button 
          onClick={handleResetFilters} 
          className="btn btn-secondary" 
          style={{ height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <span>Limpiar</span>
        </button>
      </div>

      {/* Visits List */}
      {loading ? (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Cargando visitas...</p>
        </div>
      ) : visitas.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <ClipboardList size={56} style={{ marginBottom: '16px', opacity: '0.4' }} />
          <h3>No se encontraron visitas</h3>
          <p style={{ marginTop: '8px' }}>Intente cambiar los filtros o registre una nueva visita.</p>
        </div>
      ) : (
        <div className="visits-grid">
          {visitas.map((visita) => (
            <div key={visita.id} className="visit-card glass-panel">
              <div 
                className="visit-img-container" 
                style={{ cursor: 'pointer' }}
                onClick={() => setActivePhoto(`${API_BASE_URL}${visita.foto_url}`)}
              >
                <img
                  src={`${API_BASE_URL}${visita.foto_url}`}
                  alt={visita.taller_nombre}
                  className="visit-img"
                  onError={(e) => {
                    e.target.src = 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?q=80&w=400&auto=format&fit=crop';
                  }}
                />
              </div>
              <div className="visit-body">
                <h3 className="visit-taller-name">{visita.taller_nombre}</h3>
                
                <div className="visit-detail-item">
                  <Calendar size={16} />
                  <span>{new Date(visita.fecha_visita).toLocaleString('es-EC')}</span>
                </div>

                <div className="visit-detail-item">
                  <MapPin size={16} />
                  <span style={{ fontSize: '0.82rem' }}>
                    Lat: {parseFloat(visita.latitud).toFixed(6)}, Lng: {parseFloat(visita.longitud).toFixed(6)}
                  </span>
                </div>

                {visita.observacion && (
                  <div className="visit-detail-item" style={{ alignItems: 'flex-start' }}>
                    <FileText size={16} />
                    <span style={{ fontSize: '0.82rem' }}>{visita.observacion}</span>
                  </div>
                )}

                <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${visita.latitud},${visita.longitud}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ padding: '8px 12px', fontSize: '0.85rem', textDecoration: 'none' }}
                  >
                    <span>Ver en Google Maps</span>
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image Modal Lightbox */}
      {activePhoto && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.9)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={() => setActivePhoto(null)}
        >
          <button
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              color: '#fff',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={() => setActivePhoto(null)}
          >
            <X size={24} />
          </button>
          <img 
            src={activePhoto} 
            alt="Visita ampliada" 
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.8)' }}
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  );
}
