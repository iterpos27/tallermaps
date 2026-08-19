import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, CalendarClock, CheckCircle2, CirclePlay, Clock3, ExternalLink, Flag,
  MapPin, Navigation, RefreshCw, Route, Wrench, XCircle
} from 'lucide-react';
import { api } from '../api/api';

const ACTIVE_STATES = new Set(['PENDIENTE', 'EN_CAMINO', 'INICIADA']);
const ROUTABLE_STATES = new Set([...ACTIVE_STATES, 'REPROGRAMADA']);
const STATUS_LABELS = {
  PENDIENTE: 'Pendiente',
  EN_CAMINO: 'En camino',
  INICIADA: 'Iniciada',
  EJECUTADA: 'Realizada',
  FALLIDA: 'Fallida',
  REPROGRAMADA: 'Reprogramada',
  CANCELADA: 'Cancelada'
};

const todayInput = () => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
};

const tomorrowInput = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const offset = tomorrow.getTimezoneOffset() * 60000;
  return new Date(tomorrow.getTime() - offset).toISOString().slice(0, 10);
};

const distanceMeters = (first, second) => {
  const radius = 6371000;
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(first.latitude)) * Math.cos(toRadians(second.latitude))
    * Math.sin(longitudeDelta / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const formatDistance = (meters) => meters < 1000
  ? `${Math.round(meters)} m`
  : `${(meters / 1000).toFixed(1)} km`;

const getCurrentPosition = () => new Promise((resolve, reject) => {
  if (!navigator.geolocation) {
    reject(new Error('Este dispositivo no permite obtener la ubicación.'));
    return;
  }
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
    () => reject(new Error('Active el permiso de ubicación para optimizar la ruta.')),
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
  );
});

export default function MiRutaHoy() {
  const date = useMemo(todayInput, []);
  const [stops, setStops] = useState([]);
  const [position, setPosition] = useState(null);
  const [failureId, setFailureId] = useState(null);
  const [failureReason, setFailureReason] = useState('');
  const [rescheduleId, setRescheduleId] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState(tomorrowInput);
  const [rescheduleTime, setRescheduleTime] = useState('08:00');
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState(null);
  const [optimizing, setOptimizing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchRoute = async () => {
    setError('');
    try {
      setStops(await api.programaciones.list({ fecha_inicio: date, fecha_fin: date }));
    } catch (requestError) {
      setError(requestError.message || 'No se pudo cargar la ruta de hoy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoute(); }, [date]);

  const activeStops = useMemo(() => stops.filter((stop) => ROUTABLE_STATES.has(stop.estado)), [stops]);
  const completedCount = stops.filter((stop) => stop.estado === 'EJECUTADA').length;

  const routeMetrics = useMemo(() => {
    if (!position || activeStops.length === 0) return { distances: new Map(), total: 0 };
    const distances = new Map();
    let previous = position;
    let total = 0;
    activeStops.forEach((stop) => {
      const destination = { latitude: Number(stop.taller_latitud), longitude: Number(stop.taller_longitud) };
      const distance = distanceMeters(previous, destination);
      distances.set(stop.id, distance);
      total += distance;
      previous = destination;
    });
    return { distances, total };
  }, [activeStops, position]);

  const optimizeRoute = async () => {
    setOptimizing(true);
    setError('');
    setSuccess('');
    try {
      const currentPosition = await getCurrentPosition();
      setPosition(currentPosition);
      await api.programaciones.optimizeToday({
        fecha: date,
        latitud: currentPosition.latitude,
        longitud: currentPosition.longitude
      });
      setSuccess('Ruta ordenada desde su ubicación actual.');
      await fetchRoute();
    } catch (requestError) {
      setError(requestError.message || 'No se pudo optimizar la ruta.');
    } finally {
      setOptimizing(false);
    }
  };

  const updateStatus = async (id, estado, motivoFallo = '', additionalData = {}) => {
    setWorkingId(id);
    setError('');
    setSuccess('');
    try {
      await api.programaciones.update(id, { estado, motivo_fallo: motivoFallo, ...additionalData });
      setFailureId(null);
      setRescheduleId(null);
      setFailureReason('');
      setSuccess(`Visita marcada como ${STATUS_LABELS[estado].toLowerCase()}.`);
      await fetchRoute();
    } catch (requestError) {
      setError(requestError.message || 'No se pudo actualizar la visita.');
    } finally {
      setWorkingId(null);
    }
  };

  const openCompleteRoute = () => {
    if (activeStops.length === 0) return;
    const coordinates = activeStops.map((stop) => `${stop.taller_latitud},${stop.taller_longitud}`);
    const destination = coordinates.at(-1);
    const waypoints = coordinates.slice(0, -1).join('|');
    const params = new URLSearchParams({ api: '1', destination, travelmode: 'driving' });
    if (position) params.set('origin', `${position.latitude},${position.longitude}`);
    if (waypoints) params.set('waypoints', waypoints);
    window.open(`https://www.google.com/maps/dir/?${params.toString()}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div>
      <div className="page-header daily-route-header">
        <div>
          <h1 className="page-title">Mi ruta de hoy</h1>
          <p className="page-subtitle">{new Date(`${date}T12:00:00`).toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="daily-route-header-actions">
          <button type="button" className="btn btn-secondary" onClick={optimizeRoute} disabled={optimizing || activeStops.length === 0}>
            <RefreshCw size={17} className={optimizing ? 'spin-icon' : ''} /> {optimizing ? 'Optimizando...' : 'Optimizar ruta'}
          </button>
          <button type="button" className="btn btn-primary" onClick={openCompleteRoute} disabled={activeStops.length === 0}>
            <Navigation size={17} /> Abrir ruta completa
          </button>
        </div>
      </div>

      {error ? <div className="alert alert-danger"><AlertTriangle size={18} /> {error}</div> : null}
      {success ? <div className="alert alert-success"><CheckCircle2 size={18} /> {success}</div> : null}

      <div className="daily-route-summary">
        <div className="glass-panel"><Route size={20} /><span><strong>{activeStops.length}</strong> paradas pendientes</span></div>
        <div className="glass-panel"><CheckCircle2 size={20} /><span><strong>{completedCount}</strong> realizadas</span></div>
        <div className="glass-panel"><Navigation size={20} /><span><strong>{position ? formatDistance(routeMetrics.total) : '—'}</strong> recorrido estimado</span></div>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /><p>Cargando ruta...</p></div>
      ) : stops.length === 0 ? (
        <div className="glass-panel schedule-empty-state">
          <Route size={34} />
          <h2>No tiene visitas para hoy</h2>
          <p>Puede agregarlas desde la programación semanal.</p>
          <Link className="btn btn-primary" to="/programar-visitas">Programar visitas</Link>
        </div>
      ) : (
        <div className="daily-route-list">
          {stops.map((stop, index) => {
            const latitude = Number(stop.taller_latitud);
            const longitude = Number(stop.taller_longitud);
            const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
            const wazeUrl = `https://www.waze.com/ul?ll=${latitude},${longitude}&navigate=yes`;
            return (
              <article key={stop.id} className={`glass-panel daily-route-stop status-${stop.estado.toLowerCase()}`}>
                <div className="daily-route-number">{stop.orden_ruta || index + 1}</div>
                <div className="daily-route-stop-body">
                  <div className="daily-route-stop-heading">
                    <div>
                      <span className={`route-status route-status-${stop.estado.toLowerCase()}`}>{STATUS_LABELS[stop.estado] || stop.estado}</span>
                      <h2>{stop.taller_nombre}</h2>
                    </div>
                    <span className="daily-route-time"><Clock3 size={15} /> {String(stop.hora_programada).slice(0, 5)}</span>
                  </div>
                  <div className="daily-route-meta">
                    <span><MapPin size={15} /> {stop.taller_direccion || stop.sector_nombre || 'Ubicación registrada'}</span>
                    {routeMetrics.distances.has(stop.id) ? <span><Route size={15} /> {formatDistance(routeMetrics.distances.get(stop.id))} desde la parada anterior</span> : null}
                  </div>
                  {stop.observacion ? <p className="daily-route-note">{stop.observacion}</p> : null}
                  {stop.motivo_fallo ? <p className="daily-route-failure"><XCircle size={15} /> {stop.motivo_fallo}</p> : null}

                  {failureId === stop.id ? (
                    <div className="daily-route-failure-form">
                      <label className="form-label" htmlFor={`failure-${stop.id}`}>Motivo de la visita fallida</label>
                      <textarea id={`failure-${stop.id}`} className="form-input" minLength={5} value={failureReason} onChange={(event) => setFailureReason(event.target.value)} placeholder="Ej.: Taller cerrado o propietario ausente" />
                      <div>
                        <button type="button" className="btn btn-secondary" onClick={() => setFailureId(null)}>Cancelar</button>
                        <button type="button" className="btn btn-danger" disabled={failureReason.trim().length < 5 || workingId === stop.id} onClick={() => updateStatus(stop.id, 'FALLIDA', failureReason.trim())}>Confirmar fallo</button>
                      </div>
                    </div>
                  ) : rescheduleId === stop.id ? (
                    <div className="daily-route-failure-form daily-route-reschedule-form">
                      <div className="daily-route-reschedule-grid">
                        <div>
                          <label className="form-label" htmlFor={`reschedule-date-${stop.id}`}>Nueva fecha</label>
                          <input id={`reschedule-date-${stop.id}`} type="date" className="form-input" min={tomorrowInput()} value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} />
                        </div>
                        <div>
                          <label className="form-label" htmlFor={`reschedule-time-${stop.id}`}>Nueva hora</label>
                          <input id={`reschedule-time-${stop.id}`} type="time" className="form-input" value={rescheduleTime} onChange={(event) => setRescheduleTime(event.target.value)} />
                        </div>
                      </div>
                      <div>
                        <button type="button" className="btn btn-secondary" onClick={() => setRescheduleId(null)}>Cancelar</button>
                        <button type="button" className="btn btn-primary" disabled={!rescheduleDate || !rescheduleTime || workingId === stop.id} onClick={() => updateStatus(stop.id, 'REPROGRAMADA', '', { fecha_programada: rescheduleDate, hora_programada: rescheduleTime })}>Confirmar nueva fecha</button>
                      </div>
                    </div>
                  ) : (
                    <div className="daily-route-actions">
                      <a className="btn btn-secondary" href={mapsUrl} target="_blank" rel="noreferrer"><MapPin size={16} /> Google Maps</a>
                      <a className="btn btn-secondary" href={wazeUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Waze</a>
                      {stop.estado === 'PENDIENTE' ? <button type="button" className="btn btn-primary" disabled={workingId === stop.id} onClick={() => updateStatus(stop.id, 'EN_CAMINO')}><Navigation size={16} /> Ir al taller</button> : null}
                      {stop.estado === 'EN_CAMINO' ? <button type="button" className="btn btn-primary" disabled={workingId === stop.id} onClick={() => updateStatus(stop.id, 'INICIADA')}><CirclePlay size={16} /> Iniciar visita</button> : null}
                      {stop.estado === 'INICIADA' ? <Link className="btn btn-primary" to={`/registrar-visita?programacion_id=${stop.id}`}><Wrench size={16} /> Registrar evidencia</Link> : null}
                      {ACTIVE_STATES.has(stop.estado) ? <button type="button" className="btn btn-secondary daily-route-fail-button" onClick={() => { setFailureId(stop.id); setFailureReason(''); }}><Flag size={16} /> No realizada</button> : null}
                      {ACTIVE_STATES.has(stop.estado) || stop.estado === 'FALLIDA' ? <button type="button" className="btn btn-secondary" onClick={() => { setRescheduleId(stop.id); setRescheduleDate(tomorrowInput()); setRescheduleTime(String(stop.hora_programada).slice(0, 5)); }}><CalendarClock size={16} /> Reprogramar</button> : null}
                      {stop.estado === 'REPROGRAMADA' ? <button type="button" className="btn btn-primary" disabled={workingId === stop.id} onClick={() => updateStatus(stop.id, 'PENDIENTE')}><CheckCircle2 size={16} /> Activar visita</button> : null}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
