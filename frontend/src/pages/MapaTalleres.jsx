import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, Marker, Popup, Polyline, Polygon, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Calendar, User, Eye, X, Navigation, Plus, MousePointer2 } from 'lucide-react';
import { api, getUser } from '../api/api';
import { getPhotoUrl, handlePhotoError } from '../utils/photo';
import MapBaseLayer from '../components/MapBaseLayer';
import MapWorkshopForm from '../components/MapWorkshopForm';

// Fixed icon assets issue in Leaflet + Vite using Custom HTML/SVG DivIcon
const SECTOR_COLORS = ['#1d5596', '#10b981', '#e2262f', '#8b5cf6', '#f59e0b', '#0891b2', '#db2777', '#4f46e5'];
const sectorIconCache = new Map();

const getSectorColor = (sector, configuredColor) => {
  if (configuredColor) return configuredColor;
  if (!sector) return '#64748b';
  const hash = [...sector].reduce((total, character) => total + character.charCodeAt(0), 0);
  return SECTOR_COLORS[hash % SECTOR_COLORS.length];
};

const createWorkshopIcon = (sector, configuredColor) => {
  const color = getSectorColor(sector, configuredColor);
  if (sectorIconCache.has(color)) return sectorIconCache.get(color);

  const icon = L.divIcon({
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
  sectorIconCache.set(color, icon);
  return icon;
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
const MAP_LAYER_STORAGE_KEY = 'tallervisitas-map-layer';

function MapWorkshopSelector({ enabled, onSelect }) {
  useMapEvents({
    click(event) {
      if (enabled) onSelect(event.latlng);
    }
  });

  return null;
}

export default function MapaTalleres() {
  const user = getUser();
  const [talleres, setTalleres] = useState([]);
  const [sectorEntities, setSectorEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activePhoto, setActivePhoto] = useState(null);
  const [selectedSector, setSelectedSector] = useState('');
  const [addingWorkshop, setAddingWorkshop] = useState(false);
  const [newWorkshopPosition, setNewWorkshopPosition] = useState(null);
  const [newWorkshopName, setNewWorkshopName] = useState('');
  const [newWorkshopSectorId, setNewWorkshopSectorId] = useState('');
  const [newWorkshopError, setNewWorkshopError] = useState('');
  const [savingWorkshop, setSavingWorkshop] = useState(false);
  const [mapLayer, setMapLayer] = useState(() => localStorage.getItem(MAP_LAYER_STORAGE_KEY) || 'street');
  const [mapLayerWarning, setMapLayerWarning] = useState('');
  
  // Routing states
  const [vendedores, setVendedores] = useState([]);
  const [selectedVendedor, setSelectedVendedor] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [routeVisits, setRouteVisits] = useState([]);

  const fetchMapData = useCallback(async () => {
    try {
      const [workshops, sectorsData] = await Promise.all([api.mapa.talleres(), api.sectores.list()]);
      setTalleres(workshops);
      setSectorEntities(sectorsData);
      setError('');
    } catch {
      setError('Error al cargar la información del mapa.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {

    const fetchVendedores = async () => {
      if (user?.role !== 'ADMIN') return;
      try {
        const users = await api.users.list();
        setVendedores(users.filter(u => u.role === 'VENDEDOR'));
      } catch (err) {
        console.error('Error fetching vendors for map route:', err);
      }
    };

    fetchMapData();
    fetchVendedores();
  }, [fetchMapData, user?.role]);

  // Fetch route visits when seller or date changes
  useEffect(() => {
    const fetchRoute = async () => {
      const canLoadRoute = selectedDate && (user?.role === 'VENDEDOR' || selectedVendedor);
      if (canLoadRoute) {
        try {
          const data = await api.visitas.list({
            vendedor_id: user?.role === 'ADMIN' ? selectedVendedor : undefined,
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
  }, [selectedVendedor, selectedDate, user?.role]);

  const sectors = useMemo(() => sectorEntities.filter((sector) => sector.is_active !== false), [sectorEntities]);

  const visibleWorkshops = useMemo(() => (
    selectedSector ? talleres.filter((taller) => String(taller.sector_id) === selectedSector) : talleres
  ), [selectedSector, talleres]);

  const closeWorkshopForm = () => {
    if (savingWorkshop) return;
    setNewWorkshopPosition(null);
    setNewWorkshopName('');
    setNewWorkshopSectorId('');
    setNewWorkshopError('');
  };

  const cancelAddingWorkshop = () => {
    closeWorkshopForm();
    setAddingWorkshop(false);
  };

  const handleMapWorkshopSelect = ({ lat, lng }) => {
    if (user?.role !== 'ADMIN') return;
    setNewWorkshopPosition({ lat, lng });
    setNewWorkshopError('');
  };

  const handleCreateWorkshop = async (event) => {
    event.preventDefault();
    if (user?.role !== 'ADMIN' || !newWorkshopPosition) return;
    if (!newWorkshopName.trim()) {
      setNewWorkshopError('Ingrese el nombre del taller.');
      return;
    }

    setSavingWorkshop(true);
    setNewWorkshopError('');
    try {
      await api.talleres.create({
        nombre: newWorkshopName.trim(),
        latitud: newWorkshopPosition.lat,
        longitud: newWorkshopPosition.lng,
        sector_id: newWorkshopSectorId || null,
        tipo: 'TALLER'
      });
      await fetchMapData();
      setAddingWorkshop(false);
      setNewWorkshopPosition(null);
      setNewWorkshopName('');
      setNewWorkshopSectorId('');
    } catch (requestError) {
      setNewWorkshopError(requestError.message || 'No se pudo registrar el taller.');
    } finally {
      setSavingWorkshop(false);
    }
  };

  const selectMapLayer = (layer) => {
    setMapLayer(layer);
    setMapLayerWarning('');
    localStorage.setItem(MAP_LAYER_STORAGE_KEY, layer);
  };

  const handleLayerUnavailable = (failedLayer) => {
    if (failedLayer === 'satellite') {
      setMapLayer('street');
      localStorage.setItem(MAP_LAYER_STORAGE_KEY, 'street');
      setMapLayerWarning('La vista satelital no respondió. Se restauró el mapa normal automáticamente.');
      return;
    }
    setMapLayerWarning('Algunas secciones del mapa no pudieron cargarse. Revise la conexión e inténtelo nuevamente.');
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Mapa de talleres</h1>
          <p className="page-subtitle">Ubicaciones registradas</p>
        </div>
        {user?.role === 'ADMIN' && (
          <button
            type="button"
            className={addingWorkshop ? 'btn btn-secondary' : 'btn btn-primary'}
            onClick={() => addingWorkshop ? cancelAddingWorkshop() : setAddingWorkshop(true)}
            style={{ width: 'auto' }}
          >
            {addingWorkshop ? <X size={18} /> : <Plus size={18} />}
            {addingWorkshop ? 'Cancelar' : 'Agregar taller desde el mapa'}
          </button>
        )}
      </div>

      {user?.role === 'ADMIN' && addingWorkshop && (
        <div className="alert alert-info" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <MousePointer2 size={18} />
          <span>Haz clic en la ubicación exacta del nuevo taller para completar su registro.</span>
        </div>
      )}

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
          value={selectedSector}
          onChange={(event) => setSelectedSector(event.target.value)}
          style={{ padding: '8px 12px', height: '40px', fontSize: '0.85rem' }}
          aria-label="Filtrar talleres por sector"
        >
          <option value="">Todos los sectores</option>
          {sectors.map((sector) => <option key={sector.id} value={sector.id}>{sector.nombre}</option>)}
        </select>
        
        {user?.role === 'ADMIN' && (
          <select
            className="form-input form-select"
            value={selectedVendedor}
            onChange={(e) => setSelectedVendedor(e.target.value)}
            style={{ padding: '8px 12px', height: '40px', fontSize: '0.85rem' }}
          >
            <option value="">Seleccionar vendedor</option>
            {vendedores.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        )}

        <input
          type="date"
          className="form-input"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          style={{ padding: '8px 12px', height: '40px', fontSize: '0.85rem' }}
        />

        {(selectedVendedor || selectedDate || selectedSector) && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => { setSelectedVendedor(''); setSelectedDate(''); setSelectedSector(''); }}
            style={{ padding: '8px 12px', height: '40px', fontSize: '0.85rem', width: 'auto' }}
          >
            Limpiar filtros
          </button>
        )}

      </div>

      {sectors.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', margin: '-8px 0 16px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <strong>Sectores:</strong>
          {sectors.map((sector) => (
            <button
              key={sector.id}
              type="button"
              onClick={() => setSelectedSector((current) => current === String(sector.id) ? '' : String(sector.id))}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 8px', borderRadius: '999px', border: selectedSector === String(sector.id) ? `2px solid ${sector.color}` : '1px solid var(--border-light)', background: '#fff', cursor: 'pointer', color: 'var(--text-dark)' }}
            >
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: sector.color }}></span>
              {sector.nombre} ({sector.talleres_count})
            </button>
          ))}
        </div>
      )}

      {mapLayerWarning && (
        <div className="alert" style={{ marginBottom: '16px' }} role="status">
          <span>{mapLayerWarning}</span>
        </div>
      )}

      {loading ? (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>Cargando mapa y marcadores...</p>
        </div>
      ) : (
        <div className="map-view-container">
          <div className="map-layer-switcher" role="group" aria-label="Vista del mapa">
            <button type="button" className={mapLayer === 'street' ? 'active' : ''} onClick={() => selectMapLayer('street')} aria-pressed={mapLayer === 'street'}>Mapa</button>
            <button type="button" className={mapLayer === 'satellite' ? 'active' : ''} onClick={() => selectMapLayer('satellite')} aria-pressed={mapLayer === 'satellite'}>Satélite</button>
          </div>
          <MapContainer 
            center={ECUADOR_CENTER} 
            zoom={DEFAULT_ZOOM} 
            scrollWheelZoom={true} 
            style={{ width: '100%', height: '100%', cursor: addingWorkshop ? 'crosshair' : undefined }}
          >
            <MapWorkshopSelector
              enabled={user?.role === 'ADMIN' && addingWorkshop}
              onSelect={handleMapWorkshopSelect}
            />
            <MapBaseLayer layer={mapLayer} onUnavailable={handleLayerUnavailable} />
            {sectors.filter((sector) => sector.poligono_geojson).map((sector) => (
              <Polygon
                key={`sector-${sector.id}`}
                positions={sector.poligono_geojson.coordinates[0].map(([lng, lat]) => [lat, lng])}
                pathOptions={{ color: sector.color, fillColor: sector.color, fillOpacity: 0.12, weight: 2 }}
              />
            ))}
            {visibleWorkshops.map((taller) => {
              const lat = parseFloat(taller.latitud);
              const lng = parseFloat(taller.longitud);
              const hasVisits = !!taller.fecha_visita;

              if (isNaN(lat) || isNaN(lng)) return null;

              return (
                <Marker 
                  key={taller.id} 
                  position={[lat, lng]} 
                  icon={createWorkshopIcon(taller.sector, taller.sector_color)}
                >
                  <Popup>
                    <div className="map-popup-card">
                      {hasVisits ? (
                        <div style={{ position: 'relative' }}>
                          <img 
                            src={getPhotoUrl(taller.foto_url)}
                            alt={taller.nombre} 
                            className="map-popup-img"
                            onError={handlePhotoError}
                          />
                          <button
                            type="button"
                            onClick={() => setActivePhoto(getPhotoUrl(taller.foto_url))}
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

                        <div className="map-popup-info">
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: getSectorColor(taller.sector), flexShrink: 0 }}></span>
                          <span>Sector: {taller.sector || 'Sin sector'}</span>
                        </div>
                        <div className="map-popup-info">
                          <User size={12} />
                          <span>Responsable: {taller.vendedor_asignado_nombre || 'Sin asignar'}</span>
                        </div>
                        
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
                              src={getPhotoUrl(visita.foto_url)}
                              alt={visita.taller_nombre} 
                              className="map-popup-img"
                              onError={handlePhotoError}
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

      {user?.role === 'ADMIN' && (
        <MapWorkshopForm
          position={newWorkshopPosition}
          name={newWorkshopName}
          onNameChange={(event) => setNewWorkshopName(event.target.value)}
          sectorId={newWorkshopSectorId}
          onSectorChange={(event) => setNewWorkshopSectorId(event.target.value)}
          sectors={sectors}
          error={newWorkshopError}
          saving={savingWorkshop}
          onClose={closeWorkshopForm}
          onSubmit={handleCreateWorkshop}
        />
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
            onError={handlePhotoError}
            onClick={(e) => e.stopPropagation()} 
          />
        </div>
      )}
    </div>
  );
}
