import { useEffect, useMemo, useState } from 'react';
import { Circle, CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import {
  Building2, CheckCircle2, LocateFixed, MapPin, Pencil, Plus,
  Ruler, Store, Warehouse, X
} from 'lucide-react';
import { api } from '../api/api';
import AlertBanner from '../components/AlertBanner';
import Modal from '../components/Modal';

const ECUADOR_CENTER = [-1.8312, -78.1834];

const TYPE_LABELS = {
  MATRIZ: 'Matriz',
  LOCAL: 'Local',
  ALMACEN: 'Almacén'
};

const mapsUrl = (point) => `https://www.google.com/maps?q=${point.latitud},${point.longitud}`;

function PointTypeIcon({ type, size = 19 }) {
  if (type === 'MATRIZ') return <Building2 size={size} />;
  if (type === 'LOCAL') return <Store size={size} />;
  return <Warehouse size={size} />;
}

function LocationPicker({ position, radius, onSelect }) {
  useMapEvents({
    click(event) {
      onSelect([event.latlng.lat, event.latlng.lng]);
    }
  });

  if (!position) return null;
  return (
    <>
      <Circle center={position} radius={radius} pathOptions={{ color: '#1d5596', fillColor: '#3b82f6', fillOpacity: 0.14 }} />
      <CircleMarker center={position} radius={9} pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#1d5596', fillOpacity: 1 }} />
    </>
  );
}

function RecenterMap({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 17, { duration: 0.8 });
  }, [map, position]);
  return null;
}

export default function GestionAlmacenes() {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('ALMACEN');
  const [radio, setRadio] = useState('100');
  const [position, setPosition] = useState(null);

  const stats = useMemo(() => {
    const matrixCount = points.filter((point) => point.tipo === 'MATRIZ').length;
    const averageRadius = points.length
      ? Math.round(points.reduce((total, point) => total + Number(point.radio_geocerca_metros || 0), 0) / points.length)
      : 0;
    return { total: points.length, matrixCount, averageRadius };
  }, [points]);

  const fetchPoints = async () => {
    try {
      setLoading(true);
      setPoints(await api.talleres.list({ tipo: 'EMPRESA' }));
    } catch (requestError) {
      setError(requestError.message || 'No se pudieron obtener los puntos de la empresa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPoints(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setNombre('');
    setTipo('ALMACEN');
    setRadio('100');
    setPosition(null);
  };

  const openCreate = () => {
    resetForm();
    setError('');
    setSuccess('');
    setModalOpen(true);
  };

  const openEdit = (point) => {
    setEditingId(point.id);
    setNombre(point.nombre);
    setTipo(point.tipo);
    setRadio(String(point.radio_geocerca_metros || 100));
    setPosition([Number(point.latitud), Number(point.longitud)]);
    setError('');
    setSuccess('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    resetForm();
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Este dispositivo no permite obtener la ubicación GPS.');
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition([coords.latitude, coords.longitude]);
        setLocating(false);
      },
      () => {
        setError('No se pudo obtener la ubicación. Revise el permiso de GPS del navegador.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!position) {
      setError('Seleccione la ubicación del punto en el mapa.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    const payload = {
      nombre: nombre.trim(),
      tipo,
      radio_geocerca_metros: Number(radio),
      latitud: position[0],
      longitud: position[1]
    };
    try {
      if (editingId) await api.talleres.update(editingId, payload);
      else await api.talleres.create(payload);
      const savedName = nombre.trim();
      setModalOpen(false);
      resetForm();
      setSuccess(editingId
        ? `${savedName} fue actualizado correctamente.`
        : `${savedName} fue registrado como punto operativo.`);
      await fetchPoints();
    } catch (requestError) {
      setError(requestError.message || `No se pudo ${editingId ? 'actualizar' : 'registrar'} el punto.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header warehouse-page-header">
        <div>
          <h1 className="page-title">Almacenes</h1>
          <p className="page-subtitle">Matriz, locales y puntos operativos de salida o llegada</p>
        </div>
        <button type="button" className="btn btn-primary warehouse-create-button" onClick={openCreate}>
          <Plus size={18} /> Nuevo punto
        </button>
      </div>

      <AlertBanner type="success" style={{ marginBottom: '20px' }}>{success}</AlertBanner>
      <AlertBanner style={{ marginBottom: '20px' }}>{!modalOpen ? error : ''}</AlertBanner>

      <div className="warehouse-summary-grid">
        <article className="glass-panel warehouse-summary-card">
          <span className="warehouse-summary-icon"><Warehouse size={20} /></span>
          <div><strong>{stats.total}</strong><span>Puntos activos</span></div>
        </article>
        <article className="glass-panel warehouse-summary-card">
          <span className="warehouse-summary-icon"><Building2 size={20} /></span>
          <div><strong>{stats.matrixCount}</strong><span>Matrices</span></div>
        </article>
        <article className="glass-panel warehouse-summary-card">
          <span className="warehouse-summary-icon"><Ruler size={20} /></span>
          <div><strong>{stats.averageRadius} m</strong><span>Geocerca promedio</span></div>
        </article>
      </div>

      {loading ? (
        <div className="glass-panel warehouse-loading"><div className="spinner" /><span>Cargando puntos operativos...</span></div>
      ) : points.length === 0 ? (
        <div className="glass-panel warehouse-empty-state">
          <span className="warehouse-empty-icon"><Warehouse size={34} /></span>
          <h2>No hay puntos operativos</h2>
          <p>Cree la matriz, un local o almacén y marque su ubicación exacta.</p>
          <button type="button" className="btn btn-primary" onClick={openCreate}><Plus size={17} /> Crear primer punto</button>
        </div>
      ) : (
        <section className="glass-panel warehouse-directory" aria-labelledby="warehouse-directory-title">
          <div className="warehouse-directory-header">
            <div>
              <h2 id="warehouse-directory-title">Directorio de puntos</h2>
              <p>{points.length} {points.length === 1 ? 'ubicación registrada' : 'ubicaciones registradas'}</p>
            </div>
            <CheckCircle2 size={22} />
          </div>

          <div className="warehouse-table-wrap">
            <table className="premium-table warehouse-table">
              <thead>
                <tr>
                  <th>Punto operativo</th>
                  <th>Tipo</th>
                  <th>Ubicación</th>
                  <th>Geocerca</th>
                  <th>Estado</th>
                  <th className="warehouse-actions-heading">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {points.map((point) => (
                  <tr key={point.id}>
                    <td>
                      <div className="warehouse-name-cell">
                        <span className="warehouse-point-icon"><PointTypeIcon type={point.tipo} /></span>
                        <div><strong>{point.nombre}</strong><small>ID #{point.id}</small></div>
                      </div>
                    </td>
                    <td><span className={`warehouse-type-badge type-${point.tipo.toLowerCase()}`}>{TYPE_LABELS[point.tipo] || point.tipo}</span></td>
                    <td>
                      <span className="warehouse-coordinates">{Number(point.latitud).toFixed(5)}, {Number(point.longitud).toFixed(5)}</span>
                    </td>
                    <td><span className="warehouse-radius"><Ruler size={15} /> {point.radio_geocerca_metros} m</span></td>
                    <td><span className="warehouse-active-badge"><span /> Activo</span></td>
                    <td>
                      <div className="warehouse-row-actions">
                        <a className="btn btn-secondary" href={mapsUrl(point)} target="_blank" rel="noreferrer" title="Abrir ubicación en Google Maps"><MapPin size={15} /> Mapa</a>
                        <button type="button" className="btn btn-secondary" onClick={() => openEdit(point)}><Pencil size={15} /> Editar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="warehouse-mobile-list">
            {points.map((point) => (
              <article key={point.id} className="warehouse-mobile-card">
                <div className="warehouse-mobile-heading">
                  <span className="warehouse-point-icon"><PointTypeIcon type={point.tipo} /></span>
                  <div><h3>{point.nombre}</h3><span className={`warehouse-type-badge type-${point.tipo.toLowerCase()}`}>{TYPE_LABELS[point.tipo] || point.tipo}</span></div>
                  <span className="warehouse-active-dot" title="Activo" />
                </div>
                <div className="warehouse-mobile-details">
                  <span><MapPin size={15} /> {Number(point.latitud).toFixed(5)}, {Number(point.longitud).toFixed(5)}</span>
                  <span><Ruler size={15} /> Radio de {point.radio_geocerca_metros} m</span>
                </div>
                <div className="warehouse-row-actions">
                  <a className="btn btn-secondary" href={mapsUrl(point)} target="_blank" rel="noreferrer"><MapPin size={15} /> Ver mapa</a>
                  <button type="button" className="btn btn-secondary" onClick={() => openEdit(point)}><Pencil size={15} /> Editar</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {modalOpen ? (
        <Modal onClose={closeModal} labelledBy="warehouse-form-title" maxWidth="860px">
          <div className="warehouse-modal-header">
            <div>
              <span className="warehouse-modal-eyebrow">Punto operativo</span>
              <h2 id="warehouse-form-title">{editingId ? 'Editar ubicación' : 'Nueva ubicación'}</h2>
              <p>Complete los datos y haga clic en el mapa para marcar el punto exacto.</p>
            </div>
            <button type="button" className="modal-close-static" onClick={closeModal} disabled={saving} aria-label="Cerrar"><X size={21} /></button>
          </div>

          <AlertBanner style={{ marginBottom: '16px' }}>{error}</AlertBanner>

          <form onSubmit={handleSubmit}>
            <div className="warehouse-form-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="warehouse-name">Nombre</label>
                <input id="warehouse-name" className="form-input" value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Ej. Almacén Norte" required disabled={saving} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="warehouse-type">Tipo</label>
                <select id="warehouse-type" className="form-input form-select" value={tipo} onChange={(event) => setTipo(event.target.value)} disabled={saving}>
                  <option value="ALMACEN">Almacén</option>
                  <option value="MATRIZ">Matriz</option>
                  <option value="LOCAL">Local</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="warehouse-radius">Radio de geocerca</label>
                <div className="input-wrapper">
                  <input id="warehouse-radius" type="number" min="20" max="1000" step="1" className="form-input" value={radio} onChange={(event) => setRadio(event.target.value)} required disabled={saving} />
                  <span className="schedule-duration-unit">m</span>
                </div>
              </div>
            </div>

            <div className="warehouse-map-shell">
              <MapContainer center={position || ECUADOR_CENTER} zoom={position ? 17 : 6} className="warehouse-location-map" scrollWheelZoom>
                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <LocationPicker position={position} radius={Number(radio) || 100} onSelect={setPosition} />
                <RecenterMap position={position} />
              </MapContainer>
              <div className="warehouse-map-hint"><MapPin size={16} /> Haga clic sobre el mapa para cambiar la ubicación</div>
            </div>

            <div className="warehouse-location-toolbar">
              <button type="button" className="btn btn-secondary" onClick={useCurrentLocation} disabled={locating || saving}>
                <LocateFixed size={17} /> {locating ? 'Obteniendo GPS...' : 'Usar mi ubicación'}
              </button>
              <span className={position ? 'selected' : ''}>
                {position ? `${position[0].toFixed(6)}, ${position[1].toFixed(6)}` : 'Ubicación pendiente'}
              </span>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={saving}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving || !position || !nombre.trim()}>
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear punto'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
