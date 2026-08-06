import React, { useEffect, useState } from 'react';
import { Circle, CircleMarker, MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Building2, LocateFixed, MapPin, PlusCircle, Warehouse, X } from 'lucide-react';
import { api } from '../api/api';
import AlertBanner from '../components/AlertBanner';
import Modal from '../components/Modal';

const ECUADOR_CENTER = [-1.8312, -78.1834];

const TYPE_LABELS = {
  MATRIZ: 'Matriz',
  LOCAL: 'Local',
  ALMACEN: 'Almacén'
};

function LocationPicker({ position, radius, onSelect }) {
  useMapEvents({
    click(event) {
      onSelect([event.latlng.lat, event.latlng.lng]);
    }
  });

  if (!position) return null;

  return (
    <>
      <Circle
        center={position}
        radius={radius}
        pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.14 }}
      />
      <CircleMarker
        center={position}
        radius={9}
        pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}
      />
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
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('ALMACEN');
  const [radio, setRadio] = useState('100');
  const [position, setPosition] = useState(null);

  const fetchPoints = async () => {
    try {
      setLoading(true);
      const data = await api.talleres.list({ tipo: 'EMPRESA' });
      setPoints(data);
    } catch (requestError) {
      setError(requestError.message || 'No se pudieron obtener los almacenes de la empresa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoints();
  }, []);

  const closeModal = () => {
    if (saving) return;
    setCreating(false);
    setNombre('');
    setTipo('ALMACEN');
    setRadio('100');
    setPosition(null);
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
      setError('Seleccione la ubicación del almacén en el mapa.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.talleres.create({
        nombre: nombre.trim(),
        tipo,
        radio_geocerca_metros: Number(radio),
        latitud: position[0],
        longitud: position[1]
      });
      const savedName = nombre.trim();
      setCreating(false);
      setNombre('');
      setTipo('ALMACEN');
      setRadio('100');
      setPosition(null);
      setSuccess(`${savedName} fue registrado como punto de la empresa.`);
      await fetchPoints();
    } catch (requestError) {
      setError(requestError.message || 'No se pudo registrar el almacén.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 className="page-title">Almacenes de la empresa</h1>
          <p className="page-subtitle">Administre matrices, locales y almacenes usados como puntos de salida y llegada</p>
        </div>
        <button type="button" className="btn btn-primary" style={{ width: 'auto' }} onClick={() => { setError(''); setSuccess(''); setCreating(true); }}>
          <PlusCircle size={18} /> Crear almacén
        </button>
      </div>

      <AlertBanner type="success" style={{ marginBottom: '20px' }}>{success}</AlertBanner>
      <AlertBanner style={{ marginBottom: '20px' }}>{!creating ? error : ''}</AlertBanner>

      {loading ? (
        <div className="glass-panel" style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando puntos de la empresa...</div>
      ) : points.length === 0 ? (
        <div className="glass-panel" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <Warehouse size={44} style={{ color: 'var(--primary)', marginBottom: '14px' }} />
          <h3 style={{ marginBottom: '8px' }}>Todavía no hay almacenes registrados</h3>
          <p style={{ color: 'var(--text-muted)' }}>Cree el primer punto y seleccione su ubicación exacta en el mapa.</p>
        </div>
      ) : (
        <div className="glass-panel" style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th>Ubicación</th>
                <th>Geocerca</th>
              </tr>
            </thead>
            <tbody>
              {points.map((point) => (
                <tr key={point.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
                      {point.tipo === 'MATRIZ' ? <Building2 size={18} color="var(--primary)" /> : <Warehouse size={18} color="var(--primary)" />}
                      {point.nombre}
                    </div>
                  </td>
                  <td>{TYPE_LABELS[point.tipo] || point.tipo}</td>
                  <td>
                    <a
                      href={`https://www.google.com/maps?q=${point.latitud},${point.longitud}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <MapPin size={16} /> Ver en mapa
                    </a>
                  </td>
                  <td>{point.radio_geocerca_metros} m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <Modal onClose={closeModal} labelledBy="create-warehouse-title" maxWidth="820px">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '18px' }}>
            <div>
              <h3 id="create-warehouse-title" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--primary)' }}>Crear punto de la empresa</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '4px' }}>Haga clic sobre el mapa para fijar la ubicación exacta.</p>
            </div>
            <button type="button" onClick={closeModal} disabled={saving} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={21} />
            </button>
          </div>

          <AlertBanner style={{ marginBottom: '16px' }}>{error}</AlertBanner>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Nombre</label>
                <input className="form-input" value={nombre} onChange={(event) => setNombre(event.target.value)} placeholder="Ej. Almacén Norte" required disabled={saving} />
              </div>
              <div className="form-group">
                <label className="form-label">Tipo</label>
                <select className="form-input form-select" value={tipo} onChange={(event) => setTipo(event.target.value)} disabled={saving}>
                  <option value="ALMACEN">Almacén</option>
                  <option value="MATRIZ">Matriz</option>
                  <option value="LOCAL">Local</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Radio (metros)</label>
                <input type="number" min="20" max="1000" step="1" className="form-input" value={radio} onChange={(event) => setRadio(event.target.value)} required disabled={saving} />
              </div>
            </div>

            <div style={{ marginBottom: '12px', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
              <MapContainer center={ECUADOR_CENTER} zoom={6} style={{ height: '360px', width: '100%' }} scrollWheelZoom>
                <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <LocationPicker position={position} radius={Number(radio) || 100} onSelect={setPosition} />
                <RecenterMap position={position} />
              </MapContainer>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={useCurrentLocation} disabled={locating || saving}>
                <LocateFixed size={17} /> {locating ? 'Obteniendo GPS...' : 'Usar mi ubicación'}
              </button>
              <span style={{ color: position ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '0.86rem' }}>
                {position ? `${position[0].toFixed(6)}, ${position[1].toFixed(6)}` : 'Ubicación pendiente'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={closeModal} disabled={saving}>Cancelar</button>
              <button type="submit" className="btn btn-primary" style={{ width: 'auto' }} disabled={saving || !position || !nombre.trim()}>
                {saving ? 'Guardando...' : 'Guardar almacén'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
