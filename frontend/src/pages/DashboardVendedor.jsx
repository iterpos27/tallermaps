import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { PlusCircle, ClipboardList, MapPin, Calendar, ArrowRight, CalendarDays, FileText } from 'lucide-react';
import { api, getUser, API_BASE_URL } from '../api/api';

export default function DashboardVendedor() {
  const user = getUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [visitas, setVisitas] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await api.visitas.list();
        setVisitas(data);
      } catch (err) {
        setError('No se pudo cargar la información de visitas.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalVisitas = visitas.length;
  const ultimasVisitas = visitas.slice(0, 3); // last 3 visits

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Bienvenido, {user?.name}</h1>
          <p className="page-subtitle">Módulo de Vendedor • Panel de Control</p>
        </div>
        <button
          onClick={() => navigate('/registrar-visita')}
          className="btn btn-primary"
          style={{ width: 'auto' }}
        >
          <PlusCircle size={20} />
          <span>Registrar Nueva Visita</span>
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '24px' }}>
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Cargando información...</p>
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="stats-grid">
            <div className="stat-card glass-panel">
              <div className="stat-info">
                <span className="stat-label">Visitas Registradas</span>
                <span className="stat-value">{totalVisitas}</span>
              </div>
              <div className="stat-icon-wrapper stat-icon-primary">
                <ClipboardList size={24} />
              </div>
            </div>

            <div className="stat-card glass-panel">
              <div className="stat-info">
                <span className="stat-label">Último Taller Visitado</span>
                <span className="stat-value" style={{ fontSize: '1.2rem', marginTop: '6px', fontWeight: '600' }}>
                  {totalVisitas > 0 ? visitas[0].taller_nombre : 'Ninguno aún'}
                </span>
              </div>
              <div className="stat-icon-wrapper stat-icon-success">
                <MapPin size={24} />
              </div>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '40px' }}>
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', fontWeight: '600' }}>Planifica tu semana</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
                Selecciona los talleres que vas a visitar y deja una observacion previa para cada recorrido.
              </p>
              <button onClick={() => navigate('/programar-visitas')} className="btn btn-primary">
                <CalendarDays size={18} />
                <span>Programar Visitas</span>
              </button>
            </div>

            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', fontWeight: '600' }}>Historial Completo</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>
                  Consulta las visitas que has realizado, junto con fotos, GPS y observaciones.
                </p>
              </div>
              <button onClick={() => navigate('/mis-visitas')} className="btn btn-secondary">
                <ClipboardList size={18} />
                <span>Ver Mis Visitas</span>
              </button>
            </div>
          </div>

          {/* Latest Visits List */}
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Últimas Visitas Registradas</h2>
              {totalVisitas > 3 && (
                <Link to="/mis-visitas" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Ver todas</span>
                  <ArrowRight size={16} />
                </Link>
              )}
            </div>

            {totalVisitas === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                <MapPin size={48} style={{ marginBottom: '12px', opacity: '0.5' }} />
                <p>Aún no has registrado ninguna visita.</p>
                <button
                  onClick={() => navigate('/registrar-visita')}
                  className="btn btn-primary"
                  style={{ width: 'auto', marginTop: '16px' }}
                >
                  Registrar mi primera visita
                </button>
              </div>
            ) : (
              <div className="visits-grid">
                {ultimasVisitas.map((visita) => (
                  <div key={visita.id} className="visit-card glass-panel">
                    <div className="visit-img-container">
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
                        <span style={{ fontSize: '0.8rem' }}>
                          Lat: {parseFloat(visita.latitud).toFixed(6)}, Lng: {parseFloat(visita.longitud).toFixed(6)}
                        </span>
                      </div>
                      {visita.observacion && (
                        <div className="visit-detail-item" style={{ alignItems: 'flex-start' }}>
                          <FileText size={16} />
                          <span style={{ fontSize: '0.8rem' }}>{visita.observacion}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
