import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Calendar, User, Eye, X, Navigation } from 'lucide-react';
import { api, API_BASE_URL } from '../api/api';

// Fixed icon assets issue in Leaflet + Vite using Custom HTML/SVG DivIcon
const createWorkshopIcon = (hasVisits) => {
  const color = hasVisits ? '#10b981' : '#1d5596'; // green if visited, blue if empty
  return L.divIcon({
    html: `
      <div style="
        background-color: ${color}; 
        width: 28px; 
        height: 28px; 
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #ffffff;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      ">
        <div style="
          width: 10px; 
          height: 10px; 
          border-radius: 50%; 
          background-color: #ffffff;
          transform: rotate(45deg);
        "></div>
      </div>
    `,
    className: 'custom-map-pin',
    iconSize: [28, 28],
    iconAnchor: [14, 28], // anchors bottom point
    popupAnchor: [0, -28]
  });
};

// Route stop marker icon
const createRouteNumberIcon = (number) => {
  return L.divIcon({
    html: `
      <div style="
        background-color: #e2262f; 
        color: #ffffff;
        width: 24px; 
        height: 24px; 
        border-radius: 50%; 
        border: 2px solid #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 0.75rem;
        box-shadow: 0 2px 8px rgba(0,0,0,0.25);
      ">${number}</div>
    `,
    className: 'route-number-pin',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12]
  });
};

// Center map on Ecuador
const ECUADOR_CENTER = [-1.831239, -78.183406];
const DEFAULT_ZOOM = 7;

export default function MapaTalleres() {
  const [talleres, setTalleres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePhoto, setActivePhoto] = useState(null);
  
  // Routing states
  const [vendedores, setVendedores] = useState([]);
  const [selectedVendedor, setSelectedVendedor] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [routeVisits, setRouteVisits] = useState([]);

  useEffect(() => {
    const fetchMapData = async () => {
      try {
        const data = await api.mapa.talleres();
        setTalleres(data);
      } catch (err) {
        setError('Error al cargar la información del mapa.');
      } finally {
        setLoading(false);
      }
    };

    const fetchVendedores = async () => {
      try {
        const users = await api.users.list();
        setVendedores(users.filter(u => u.role === 'VENDEDOR'));
      } catch (err) {
        console.error('Error fetching vendors for map route:', err);
      }
    };

    fetchMapData();
    fetchVendedores();
  }, []);

  // Fetch route visits when seller or date changes
  useEffect(() => {
    const fetchRoute = async () => {
      if (selectedVendedor && selectedDate) {
        try {
          const data = await api.visitas.list({
            vendedor_id: selectedVendedor,
            fecha_inicio: selectedDate,
            fecha_fin: selectedDate
          });
          // Sort chronologically (oldest to newest)
          const sorted = [...data].sort((a, b) => new Date(a.fecha_visita) - new Date(b.fecha_visita));
          setRouteVisits(sorted);
        } catch (err) {
          console.error('Error fetching route:', err);
        }
      } else {
        setRouteVisits([]);
      }
    };
    fetchRoute();
  }, [selectedVendedor, selectedDate]);

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Mapa General de Talleres</h1>
          <p className="page-subtitle">Visualización geográfica de todos los talleres registrados</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
          <span>{error}</span>
        </div>
      )}

      {/* Route Filter Panel */}
      <div 
        className="filter-bar glass-panel" 
        style={{ 
          marginBottom: '20px', 
          padding: '12px 20px', 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Navigation size={18} color="var(--primary)" style={{ transform: 'rotate(45deg)' }} />
          <strong style={{ fontSize: '0.9rem' }}>Trazar Ruta de Visitas:</strong>
        </div>
        
        <select
          className="form-input form-select"
          value={selectedVendedor}
          onChange={(e) => setSelectedVendedor(e.target.value)}
          style={{ padding: '8px 12px', height: '40px', fontSize: '0.85rem' }}
        >
          <option value="">-- Seleccionar Vendedor --</option>
          {vendedores.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>

        <input
          type="date"
          className="form-input"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{ padding: '8px 12px', height: '40px', fontSize: '0.85rem' }}
        />

        {(selectedVendedor || selectedDate) && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => { setSelectedVendedor(''); setSelectedDate(''); }}
            style={{ padding: '8px 12px', height: '40px', fontSize: '0.85rem', width: 'auto' }}
          >
            Limpiar Ruta
          </button>
        )}
      </div>

      {loading ? (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Cargando mapa y marcadores...</p>
        </div>
      ) : (
        <div className="map-view-container">
          <MapContainer 
            center={ECUADOR_CENTER} 
            zoom={DEFAULT_ZOOM} 
            scrollWheelZoom={true} 
            style={{ width: '100%', height: '100%' }}
          >
            {/* Light Theme TileLayer (Voyager) */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            />

            {talleres.map((taller) => {
              const lat = parseFloat(taller.latitud);
              const lng = parseFloat(taller.longitud);
              const hasVisits = !!taller.fecha_visita;

              // Validate coordinates
              if (isNaN(lat) || isNaN(lng)) return null;

              return (
                <Marker 
                  key={taller.id} 
                  position={[lat, lng]} 
                  icon={createWorkshopIcon(hasVisits)}
                >
                  <Popup>
                    <div className="map-popup-card">
                      {hasVisits ? (
                        <div style={{ position: 'relative' }}>
                          <img 
                            src={`${API_BASE_URL}${taller.foto_url}`} 
                            alt={taller.nombre} 
                            className="map-popup-img"
                            onError={(e) => {
                              e.target.src = 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?q=80&w=400&auto=format&fit=crop';
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setActivePhoto(`${API_BASE_URL}${taller.foto_url}`)}
                            style={{
                              position: 'absolute',
                              bottom: '8px',
                              right: '8px',
                              background: 'rgba(17,24,39,0.8)',
                              border: 'none',
                              color: '#fff',
                              padding: '4px',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Ampliar Foto"
                          >
                            <Eye size={12} />
                          </button>
                        </div>
                      ) : (
                        <div 
                          className="map-popup-img" 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            backgroundColor: 'rgba(255,255,255,0.03)',
                            fontSize: '0.85rem',
                            color: 'var(--text-muted)'
                          }}
                        >
                          <span>Sin fotos registradas</span>
                        </div>
                      )}

                      <div className="map-popup-body">
                        <div className="map-popup-title">{taller.nombre}</div>
                        
                        {hasVisits ? (
                          <>
                            <div className="map-popup-info">
                              <Calendar size={12} />
                              <span>{new Date(taller.fecha_visita).toLocaleDateString('es-EC')}</span>
                            </div>
                            <div className="map-popup-info">
                              <User size={12} />
                              <span>Vendedor: {taller.vendedor_nombre}</span>
                            </div>
                          </>
                        ) : (
                          <div className="map-popup-info" style={{ color: 'var(--warning)' }}>
                            <span>Taller nuevo sin visitas</span>
                          </div>
                        )}
                        
                        <div className="map-popup-info" style={{ marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '4px' }}>
                          <MapPin size={12} />
                          <span style={{ fontSize: '0.72rem' }}>
                            {lat.toFixed(5)}, {lng.toFixed(5)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {(() => {
              const polylineCoords = routeVisits.map(v => [parseFloat(v.latitud), parseFloat(v.longitud)]).filter(coords => !isNaN(coords[0]) && !isNaN(coords[1]));
              return (
                <>
                  {polylineCoords.length > 1 && (
                    <Polyline 
                      positions={polylineCoords} 
                      color="var(--accent)" 
                      weight={4} 
                      dashArray="6, 8" 
                    />
                  )}

                  {routeVisits.map((visita, index) => {
                    const lat = parseFloat(visita.latitud);
                    const lng = parseFloat(visita.longitud);
                    if (isNaN(lat) || isNaN(lng)) return null;
                    
                    return (
                      <Marker 
                        key={`route-stop-${visita.id}`} 
                        position={[lat, lng]} 
                        icon={createRouteNumberIcon(index + 1)}
                      >
                        <Popup>
                          <div className="map-popup-card">
                            <img 
                              src={`${API_BASE_URL}${visita.foto_url}`} 
                              alt={visita.taller_nombre} 
                              className="map-popup-img"
                              onError={(e) => {
                                e.target.src = 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?q=80&w=400&auto=format&fit=crop';
                              }}
                            />
                            <div className="map-popup-body">
                              <div className="map-popup-title" style={{ color: 'var(--accent)' }}>
                                Parada #{index + 1}: {visita.taller_nombre}
                              </div>
                              <div className="map-popup-info">
                                <Calendar size={12} />
                                <span>{new Date(visita.fecha_visita).toLocaleTimeString('es-EC')}</span>
                              </div>
                              <div className="map-popup-info">
                                <MapPin size={12} />
                                <span style={{ fontSize: '0.72rem' }}>
                                  {lat.toFixed(5)}, {lng.toFixed(5)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </>
              );
            })()}
          </MapContainer>
        </div>
      )}

      {/* Lightbox for popups */}
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
            alt="Visita taller" 
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '8px' }}
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  );
}
