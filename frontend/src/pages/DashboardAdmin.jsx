import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, MapPin, ExternalLink, Users, ClipboardList, Shield, X, Map, AlertTriangle, CheckCircle, User } from 'lucide-react';
import { api, API_BASE_URL } from '../api/api';

export default function DashboardAdmin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  
  // Data lists
  const [visitas, setVisitas] = useState([]);
  const [talleres, setTalleres] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendedor, setSelectedVendedor] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  
  // Stats
  const [stats, setStats] = useState({
    totalVisitas: 0,
    totalTalleres: 0,
    totalVendedores: 0
  });

  const [selectedVisita, setSelectedVisita] = useState(null);
  const [error, setError] = useState('');

  // Fetch initial static support data (talleres and users for stats/dropdowns)
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [talleresList, usersList] = await Promise.all([
          api.talleres.list(),
          api.users.list()
        ]);
        
        setTalleres(talleresList);
        
        const sellers = usersList.filter(u => u.role === 'VENDEDOR');
        setVendedores(sellers);
        
        setStats(prev => ({
          ...prev,
          totalTalleres: talleresList.length,
          totalVendedores: sellers.length
        }));
      } catch (err) {
        console.error('Error fetching admin metadata:', err);
      }
    };
    fetchMetadata();
  }, []);

  // Fetch visits list depending on filters
  const fetchVisitas = async () => {
    try {
      const data = await api.visitas.list({
        search: searchTerm,
        vendedor_id: selectedVendedor,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin
      });
      setVisitas(data);
      // update visits count based on un-filtered list length? No, show current filtered count, or total.
      // Let's set the totalVisitas count based on full list (on first load)
      if (!searchTerm && !selectedVendedor && !fechaInicio && !fechaFin) {
        setStats(prev => ({ ...prev, totalVisitas: data.length }));
      }
    } catch (err) {
      setError('Error al obtener la lista de visitas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchVisitas();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedVendedor, fechaInicio, fechaFin]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedVendedor('');
    setFechaInicio('');
    setFechaFin('');
  };

  const handleExportCSV = () => {
    if (visitas.length === 0) return;
    
    const headers = ['NOMBRE TALLER', 'FECHA', 'QUIEN HIZO VISITA', 'OBSERVACION'];
    
    const rows = visitas.map(v => [
      `"${v.taller_nombre.replace(/"/g, '""')}"`,
      `"${new Date(v.fecha_visita).toLocaleString('es-EC')}"`,
      `"${v.vendedor_nombre.replace(/"/g, '""')}"`,
      `"${(v.observacion || '').replace(/"/g, '""')}"`
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_visitas_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Panel de Administración</h1>
          <p className="page-subtitle">Supervisión y control de visitas registradas en Ecuador</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleExportCSV}
            className="btn btn-secondary"
            style={{ width: 'auto' }}
            disabled={visitas.length === 0}
          >
            <ClipboardList size={18} />
            <span>Exportar Excel</span>
          </button>
          
          <button
            onClick={() => navigate('/mapa')}
            className="btn btn-primary"
            style={{ width: 'auto' }}
          >
            <Map size={18} />
            <span>Ver Mapa General</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '24px' }}>
          <span>{error}</span>
        </div>
      )}

      {/* Stats Board */}
      <div className="stats-grid">
        <div className="stat-card glass-panel">
          <div className="stat-info">
            <span className="stat-label">Total Visitas</span>
            <span className="stat-value">{stats.totalVisitas}</span>
          </div>
          <div className="stat-icon-wrapper stat-icon-primary">
            <ClipboardList size={24} />
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-info">
            <span className="stat-label">Talleres Registrados</span>
            <span className="stat-value">{stats.totalTalleres}</span>
          </div>
          <div className="stat-icon-wrapper stat-icon-success">
            <Shield size={24} />
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-info">
            <span className="stat-label">Vendedores Activos</span>
            <span className="stat-value">{stats.totalVendedores}</span>
          </div>
          <div className="stat-icon-wrapper stat-icon-accent">
            <Users size={24} />
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div 
        className="no-print"
        style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
          gap: '24px', 
          marginBottom: '24px' 
        }}
      >
        {/* Daily Visit volume chart */}
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} />
            <span>Volumen Diario de Visitas (Últimos 7 días)</span>
          </h3>
          <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 500 200" width="100%" height="100%">
              {(() => {
                const dailyData = (() => {
                  const dataMap = {};
                  for (let i = 6; i >= 0; i--) {
                    const d = new Date();
                    d.setDate(d.getDate() - i);
                    const dateStr = d.toISOString().split('T')[0];
                    dataMap[dateStr] = {
                      label: d.toLocaleDateString('es-EC', { weekday: 'short', day: 'numeric' }),
                      count: 0
                    };
                  }
                  
                  visitas.forEach(v => {
                    const dateStr = new Date(v.fecha_visita).toISOString().split('T')[0];
                    if (dataMap[dateStr]) {
                      dataMap[dateStr].count += 1;
                    }
                  });

                  return Object.keys(dataMap).map(k => ({
                    date: k,
                    label: dataMap[k].label,
                    count: dataMap[k].count
                  }));
                })();

                const maxCount = Math.max(...dailyData.map(d => d.count), 5);

                return dailyData.map((d, i) => {
                  const barWidth = 40;
                  const spacing = 20;
                  const x = 50 + i * (barWidth + spacing);
                  const barHeight = (d.count / maxCount) * 120;
                  const y = 150 - barHeight;
                  return (
                    <g key={d.date}>
                      <line x1="30" y1="150" x2="480" y2="150" stroke="#e2e8f0" strokeWidth="1" />
                      <line x1="30" y1="90" x2="480" y2="90" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4" />
                      <line x1="30" y1="30" x2="480" y2="30" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4" />
                      
                      <rect 
                        x={x} 
                        y={y} 
                        width={barWidth} 
                        height={Math.max(barHeight, 2)} 
                        fill="var(--primary)" 
                        rx="4"
                      />
                      <text 
                        x={x + barWidth/2} 
                        y={y - 8} 
                        textAnchor="middle" 
                        fontSize="10" 
                        fontWeight="bold"
                        fill="var(--text-main)"
                      >
                        {d.count}
                      </text>
                      <text 
                        x={x + barWidth/2} 
                        y="170" 
                        textAnchor="middle" 
                        fontSize="10" 
                        fill="var(--text-muted)"
                      >
                        {d.label}
                      </text>
                    </g>
                  );
                });
              })()}
            </svg>
          </div>
        </div>

        {/* Vendor Ranking Leaderboard */}
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--primary)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} />
            <span>Ranking de Vendedores (Visitas Realizadas)</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'center', flexGrow: 1, maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
            {(() => {
              const leaderData = (() => {
                const counts = {};
                visitas.forEach(v => {
                  counts[v.vendedor_nombre] = (counts[v.vendedor_nombre] || 0) + 1;
                });
                
                return Object.keys(counts)
                  .map(name => ({ name, count: counts[name] }))
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 5);
              })();

              const maxLeaderCount = Math.max(...leaderData.map(d => d.count), 1);

              return leaderData.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No hay datos de visitas disponibles.</p>
              ) : (
                leaderData.map((d, index) => {
                  const pct = (d.count / maxLeaderCount) * 100;
                  return (
                    <div key={d.name} style={{ width: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: '600', marginBottom: '6px' }}>
                        <span>#{index + 1} {d.name}</span>
                        <span style={{ color: 'var(--primary)' }}>{d.count} {d.count === 1 ? 'visita' : 'visitas'}</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                        <div 
                          style={{ 
                            width: `${pct}%`, 
                            height: '100%', 
                            background: index === 0 ? 'var(--accent)' : 'var(--primary)', 
                            borderRadius: '4px',
                            transition: 'width 0.6s ease-out'
                          }} 
                        />
                      </div>
                    </div>
                  );
                })
              );
            })()}
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
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
          <label className="form-label">Vendedor</label>
          <select
            className="form-input form-select"
            value={selectedVendedor}
            onChange={(e) => setSelectedVendedor(e.target.value)}
          >
            <option value="">-- Todos --</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
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

      {/* Visitas results list */}
      {loading ? (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Cargando información de visitas...</p>
        </div>
      ) : visitas.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <ClipboardList size={56} style={{ marginBottom: '16px', opacity: '0.4' }} />
          <h3>No se encontraron registros de visitas</h3>
          <p style={{ marginTop: '8px' }}>Intente ajustando los filtros de búsqueda.</p>
        </div>
      ) : (
        <div className="visits-grid">
          {visitas.map((visita) => (
            <div key={visita.id} className="visit-card glass-panel">
              <div 
                className="visit-img-container" 
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedVisita(visita)}
              >
                <img
                  src={`${API_BASE_URL}${visita.foto_url}`}
                  alt={visita.taller_nombre}
                  className="visit-img"
                  onError={(e) => {
                    e.target.src = 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?q=80&w=400&auto=format&fit=crop';
                  }}
                />
                <span className="visit-badge-role">{visita.vendedor_nombre}</span>
              </div>
              <div className="visit-body">
                <h3 className="visit-taller-name">{visita.taller_nombre}</h3>
                
                {visita.fuera_rango ? (
                  <div style={{ display: 'flex', marginBottom: '8px' }}>
                    <span 
                      style={{ 
                        display: 'inline-flex', 
                        padding: '4px 8px', 
                        fontSize: '0.72rem', 
                        fontWeight: '700', 
                        borderRadius: '4px',
                        gap: '4px',
                        alignItems: 'center',
                        color: '#ef4444',
                        background: '#fef2f2',
                        border: '1px solid #fee2e2'
                      }}
                      title={`El vendedor estaba a ${Math.round(visita.distancia_metros)} metros de las coordenadas del taller.`}
                    >
                      <AlertTriangle size={12} />
                      Fuera de Rango ({Math.round(visita.distancia_metros)}m)
                    </span>
                  </div>
                ) : (
                  visita.distancia_metros > 0 && (
                    <div style={{ display: 'flex', marginBottom: '8px' }}>
                      <span 
                        style={{ 
                          display: 'inline-flex', 
                          padding: '4px 8px', 
                          fontSize: '0.72rem', 
                          fontWeight: '700', 
                          borderRadius: '4px',
                          gap: '4px',
                          alignItems: 'center',
                          color: '#10b981',
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0'
                        }}
                      >
                        <CheckCircle size={12} />
                        En el taller ({Math.round(visita.distancia_metros)}m)
                      </span>
                    </div>
                  )
                )}

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
                    <ClipboardList size={16} />
                    <span style={{ fontSize: '0.82rem' }}>{visita.observacion}</span>
                  </div>
                )}

                <div style={{ marginTop: 'auto', paddingTop: '16px', display: 'flex', gap: '10px' }}>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${visita.latitud},${visita.longitud}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ padding: '8px 12px', fontSize: '0.82rem', textDecoration: 'none', flex: 1, display: 'flex', justifyContent: 'center' }}
                  >
                    <span>Google Maps</span>
                    <ExternalLink size={12} />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Visit Details & Print PDF Modal */}
      {selectedVisita && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            overflowY: 'auto'
          }}
          className="no-print-bg"
          onClick={() => setSelectedVisita(null)}
        >
          <div 
            id="printable-visit-card"
            className="glass-panel"
            style={{ 
              width: '100%', 
              maxWidth: '650px', 
              background: '#ffffff', 
              color: '#1f2937', 
              borderRadius: '12px', 
              overflow: 'hidden',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()} 
          >
            {/* Modal Header */}
            <div 
              style={{ 
                padding: '20px', 
                borderBottom: '1px solid #e5e7eb', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
              }}
              className="no-print"
            >
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--primary)' }}>
                Ficha Técnica de Visita
              </h3>
              <button
                type="button"
                onClick={() => setSelectedVisita(null)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: '#9ca3af', 
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Print Header (Only visible when printing) */}
            <div 
              className="print-only"
              style={{
                display: 'none',
                padding: '20px 30px',
                borderBottom: '2px solid var(--primary)',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc'
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>TallerVisitas Pro</h2>
                <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>Reporte de Visita Técnica • Ecuador</p>
              </div>
              <div style={{ textAlign: 'right', fontSize: '0.8rem', color: '#4b5563' }}>
                <strong>Fecha Impresión:</strong> {new Date().toLocaleDateString('es-EC')}
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {/* Image */}
              <div style={{ width: '100%', aspectRatio: '16/10', overflow: 'hidden', background: '#000' }}>
                <img 
                  src={`${API_BASE_URL}${selectedVisita.foto_url}`} 
                  alt={selectedVisita.taller_nombre} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>

              {/* Details grid */}
              <div style={{ padding: '24px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '20px', color: 'var(--primary)' }}>
                  {selectedVisita.taller_nombre}
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Vendedor Registrante
                    </div>
                    <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <User size={16} color="var(--primary)" />
                      <span>{selectedVisita.vendedor_nombre}</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Fecha y Hora
                    </div>
                    <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={16} color="var(--primary)" />
                      <span>{new Date(selectedVisita.fecha_visita).toLocaleString('es-EC')}</span>
                    </div>
                  </div>

                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Coordenadas GPS
                    </div>
                    <div style={{ fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <MapPin size={16} color="var(--primary)" />
                      <span style={{ fontSize: '0.9rem' }}>
                        Lat: {parseFloat(selectedVisita.latitud).toFixed(6)}, Lng: {parseFloat(selectedVisita.longitud).toFixed(6)}
                      </span>
                    </div>
                    {selectedVisita.fuera_rango ? (
                      <div style={{ color: '#ef4444', fontSize: '0.75rem', fontWeight: 'bold', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <AlertTriangle size={12} />
                        Fuera de rango por {Math.round(selectedVisita.distancia_metros)} metros!
                      </div>
                    ) : (
                      selectedVisita.distancia_metros > 0 && (
                        <div style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 'bold', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle size={12} />
                          Verificado en taller ({Math.round(selectedVisita.distancia_metros)}m)
                        </div>
                      )
                    )}
                  </div>
                </div>

                {selectedVisita.observacion && (
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', marginBottom: '4px' }}>
                      Observacion
                    </div>
                    <div style={{ fontWeight: '500', lineHeight: 1.5 }}>
                      {selectedVisita.observacion}
                    </div>
                  </div>
                )}

                {/* Print Signatures (Only when printing) */}
                <div 
                  className="print-only"
                  style={{
                    display: 'none',
                    marginTop: '50px',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '40px',
                    textAlign: 'center',
                    fontSize: '0.85rem'
                  }}
                >
                  <div>
                    <div style={{ borderTop: '1px solid #9ca3af', width: '200px', margin: '0 auto', paddingTop: '8px' }}>
                      Firma del Vendedor
                    </div>
                  </div>
                  <div>
                    <div style={{ borderTop: '1px solid #9ca3af', width: '200px', margin: '0 auto', paddingTop: '8px' }}>
                      Sello / Firma del Taller
                    </div>
                  </div>
                </div>

                {/* Action buttons */}
                <div 
                  className="no-print"
                  style={{ 
                    marginTop: '20px', 
                    paddingTop: '20px', 
                    borderTop: '1px solid #e5e7eb', 
                    display: 'flex', 
                    gap: '12px',
                    justifyContent: 'flex-end'
                  }}
                >
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${selectedVisita.latitud},${selectedVisita.longitud}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ width: 'auto', padding: '10px 18px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <span>Google Maps</span>
                    <ExternalLink size={16} />
                  </a>

                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="btn btn-primary"
                    style={{ width: 'auto', padding: '10px 24px' }}
                  >
                    <span>Imprimir Ficha (PDF)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
