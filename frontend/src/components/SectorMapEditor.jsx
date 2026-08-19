import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { AlertTriangle, CheckCircle2, MousePointer2, Trash2, Undo2, Wrench } from 'lucide-react';
import { pointInPolygon } from '../utils/sectorGeometry';

const PORTOVIEJO_CENTER = [-1.0546, -80.4545];

const polygonToPoints = (polygon) => {
  const ring = polygon?.type === 'Polygon' ? polygon.coordinates?.[0] : null;
  if (!Array.isArray(ring)) return [];

  const openRing = ring.length > 1
    && ring[0][0] === ring[ring.length - 1][0]
    && ring[0][1] === ring[ring.length - 1][1]
    ? ring.slice(0, -1)
    : ring;

  return openRing
    .map(([longitude, latitude]) => [Number(latitude), Number(longitude)])
    .filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude));
};

const pointsToPolygon = (points) => {
  if (points.length < 3) return null;
  const coordinates = points.map(([latitude, longitude]) => [longitude, latitude]);
  return { type: 'Polygon', coordinates: [[...coordinates, coordinates[0]]] };
};

function MapClickCapture({ disabled, onAddPoint }) {
  useMapEvents({
    click: ({ latlng }) => {
      if (!disabled) onAddPoint([latlng.lat, latlng.lng]);
    }
  });
  return null;
}

function InitialViewport({ points }) {
  const map = useMap();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || points.length < 2) return;
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 15 });
    initialized.current = true;
  }, [map, points]);

  return null;
}

export default function SectorMapEditor({ value, color, workshops = [], analysis, disabled = false, onChange }) {
  const [points, setPoints] = useState(() => polygonToPoints(value));
  const vertexIcon = useMemo(() => L.divIcon({
    className: 'sector-vertex-marker',
    html: `<span style="background:${color}"></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  }), [color]);

  const commitPoints = (nextPoints) => {
    setPoints(nextPoints);
    onChange(pointsToPolygon(nextPoints));
  };

  const addPoint = (point) => commitPoints([...points, point]);
  const movePoint = (index, point) => {
    const nextPoints = [...points];
    nextPoints[index] = point;
    commitPoints(nextPoints);
  };
  const undoPoint = () => commitPoints(points.slice(0, -1));
  const clearPoints = () => commitPoints([]);
  const isReady = points.length >= 3;
  const polygon = pointsToPolygon(points);
  const overlappingNames = analysis?.overlappingSectors?.map((sector) => sector.nombre) || [];

  return (
    <div className="sector-map-editor">
      <div className="sector-map-help">
        <MousePointer2 size={18} aria-hidden="true" />
        <div>
          <strong>Dibuje el límite del sector</strong>
          <span>Mueva o acerque el mapa y haga clic alrededor del área. Con 3 puntos se formará el sector; puede agregar tantos como necesite.</span>
        </div>
      </div>

      <div className="sector-map-canvas" aria-label="Mapa para delimitar el sector">
        <MapContainer center={points[0] || PORTOVIEJO_CENTER} zoom={points.length ? 14 : 12} scrollWheelZoom className="sector-map-leaflet">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickCapture disabled={disabled} onAddPoint={addPoint} />
          <InitialViewport points={points} />
          {points.length >= 2 && !isReady && (
            <Polyline positions={points} pathOptions={{ color, weight: 3, dashArray: '7 7' }} interactive={false} />
          )}
          {isReady && (
            <Polygon positions={points} pathOptions={{ color, fillColor: color, fillOpacity: 0.22, weight: 3 }} interactive={false} />
          )}
          {workshops.map((workshop) => {
            const latitude = Number(workshop.latitud);
            const longitude = Number(workshop.longitud);
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
            const isInside = pointInPolygon(longitude, latitude, polygon);
            return (
              <CircleMarker
                key={`workshop-${workshop.id}`}
                center={[latitude, longitude]}
                radius={isInside ? 5 : 3}
                pathOptions={{
                  color: isInside ? '#ffffff' : '#64748b',
                  fillColor: isInside ? color : '#94a3b8',
                  fillOpacity: isInside ? 1 : 0.65,
                  weight: isInside ? 2 : 1
                }}
                interactive={false}
              />
            );
          })}
          {points.map((point, index) => (
            <Marker
              key={`${point[0]}-${point[1]}-${index}`}
              position={point}
              icon={vertexIcon}
              draggable={!disabled}
              title={`Punto ${index + 1}: arrastre para ajustar`}
              eventHandlers={{
                dragend: (event) => {
                  const position = event.target.getLatLng();
                  movePoint(index, [position.lat, position.lng]);
                }
              }}
            />
          ))}
        </MapContainer>
      </div>

      {overlappingNames.length > 0 ? (
        <div className="sector-map-conflict" role="alert">
          <AlertTriangle size={17} />
          <span>El área se cruza con: <strong>{overlappingNames.join(', ')}</strong>. Mueva los puntos para separarla.</span>
        </div>
      ) : null}

      <div className="sector-map-toolbar">
        <div className="sector-map-summary" aria-live="polite">
          <span className={`sector-map-status ${isReady && overlappingNames.length === 0 ? 'ready' : ''}`}>
            {isReady && overlappingNames.length === 0 ? <CheckCircle2 size={16} /> : null}
            {isReady ? `Área lista · ${points.length} puntos` : `${points.length} de 3 puntos mínimos`}
          </span>
          <span className="sector-workshop-count"><Wrench size={15} /> {analysis?.workshopsInside?.length || 0} talleres dentro</span>
        </div>
        <div className="sector-map-actions">
          <button type="button" className="btn btn-secondary" onClick={undoPoint} disabled={disabled || points.length === 0}>
            <Undo2 size={15} /> Deshacer
          </button>
          <button type="button" className="btn btn-secondary" onClick={clearPoints} disabled={disabled || points.length === 0}>
            <Trash2 size={15} /> Limpiar área
          </button>
        </div>
      </div>
    </div>
  );
}
