import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle, Clock, MapPin, Navigation, AlertTriangle } from 'lucide-react';
import { api, getUser } from '../api/api';
import Modal from '../components/Modal';

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, '0')).join(':');
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20000
    });
  });
}

export default function EntregasMensajero() {
  const user = getUser();
  const [status, setStatus] = useState({ activeRoute: null, recent: [] });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showNewWorkshop, setShowNewWorkshop] = useState(false);
  const [newWorkshopName, setNewWorkshopName] = useState('');
  const [cancelReason, setCancelReason] = useState(null);
  const [, setTick] = useState(0);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await api.entregas.status());
      setError('');
    } catch (requestError) {
      setError(requestError.message || 'No se pudo consultar el recorrido.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    const refresh = () => loadStatus();
    window.addEventListener('delivery-tracking-updated', refresh);
    const statusInterval = window.setInterval(loadStatus, 30000);
    const timerInterval = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => {
      window.removeEventListener('delivery-tracking-updated', refresh);
      window.clearInterval(statusInterval);
      window.clearInterval(timerInterval);
    };
  }, [loadStatus]);

  const handleComplete = async () => {
    if (!navigator.geolocation) {
      setError('Este dispositivo no permite obtener la ubicación.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const position = await getCurrentPosition();
      const result = await api.entregas.complete({
        latitud: position.coords.latitude,
        longitud: position.coords.longitude,
        accuracy: position.coords.accuracy
      });
      setSuccess(`${result.message} Tiempo: ${formatDuration(result.delivery.duracion_segundos)}.`);
      setShowNewWorkshop(false);
      await loadStatus();
    } catch (requestError) {
      const gpsDenied = requestError?.code === 1;
      if (requestError?.status === 422) setShowNewWorkshop(true);
      setError(gpsDenied
        ? 'Permita el acceso a la ubicación para registrar la entrega.'
        : (requestError.message || 'No se pudo registrar la entrega.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterWorkshopAndComplete = async (event) => {
    event.preventDefault();
    if (!newWorkshopName.trim()) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const position = await getCurrentPosition();
      const gps = {
        latitud: position.coords.latitude,
        longitud: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
      await api.talleres.create({
        nombre: newWorkshopName.trim(),
        latitud: gps.latitud,
        longitud: gps.longitud
      });
      const result = await api.entregas.complete(gps);
      setSuccess(`Taller registrado. ${result.message} Tiempo: ${formatDuration(result.delivery.duracion_segundos)}.`);
      setShowNewWorkshop(false);
      setNewWorkshopName('');
      await loadStatus();
    } catch (requestError) {
      setError(requestError.message || 'No se pudo registrar el taller y la entrega.');
    } finally {
      setSubmitting(false);
    }
  };

  const elapsed = status.activeRoute
    ? Math.floor((Date.now() - new Date(status.activeRoute.salida_at).getTime()) / 1000)
    : 0;

  const handleCancel = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const result = await api.entregas.cancel(cancelReason);
      setCancelReason(null);
      setSuccess(result.message);
      setShowNewWorkshop(false);
      await loadStatus();
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Hola, {user?.name}</h1>
          <p className="page-subtitle">Control automático del tiempo entre salida y entrega</p>
        </div>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: '20px' }}><AlertTriangle size={18} /><span>{error}</span></div>}
      {success && <div className="alert alert-success" style={{ marginBottom: '20px' }}><CheckCircle size={18} /><span>{success}</span></div>}

      <section className="glass-panel" style={{ padding: '28px', textAlign: 'center', marginBottom: '24px' }}>
        {loading ? (
          <div className="loading-overlay"><div className="spinner" /><p>Consultando recorrido...</p></div>
        ) : status.activeRoute ? (
          <>
            <Navigation size={48} color="var(--primary)" style={{ marginBottom: '12px' }} />
            <h2 style={{ marginBottom: '8px' }}>En ruta desde {status.activeRoute.origen_nombre}</h2>
            <div style={{ fontSize: '2.3rem', fontWeight: 800, color: 'var(--primary)', margin: '18px 0' }}>
              {formatDuration(elapsed)}
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
              Al llegar, pulse el botón. El sistema elegirá automáticamente el destino según la geocerca.
            </p>
            <button type="button" className="btn btn-primary" onClick={handleComplete} disabled={submitting} style={{ maxWidth: '420px', margin: '0 auto', padding: '18px', fontSize: '1.1rem' }}>
              <CheckCircle size={22} />
              <span>{submitting ? 'Verificando ubicación...' : 'Entrega realizada'}</span>
            </button>
            <button type="button" className="btn btn-secondary" style={{ maxWidth: '420px', margin: '12px auto' }} disabled={submitting} onClick={() => setCancelReason('')}>Cancelar recorrido por incidencia</button>
            {showNewWorkshop && (
              <form onSubmit={handleRegisterWorkshopAndComplete} style={{ maxWidth: '420px', margin: '24px auto 0', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                <p style={{ fontWeight: 700, marginBottom: '10px' }}>Última opción: el taller todavía no está registrado</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '14px' }}>
                  Escriba el nombre. Se guardará usando su ubicación actual y luego se confirmará esta entrega. No se permite crear otro taller a 50 metros o menos de uno registrado.
                </p>
                <input className="form-input" value={newWorkshopName} onChange={(event) => setNewWorkshopName(event.target.value)} placeholder="Nombre del taller" required style={{ marginBottom: '12px' }} />
                <button type="submit" className="btn btn-secondary" disabled={submitting}>
                  <MapPin size={18} /> Registrar taller y entrega
                </button>
              </form>
            )}
          </>
        ) : (
          <>
            <MapPin size={48} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
            <h2 style={{ marginBottom: '8px' }}>Sin recorrido activo</h2>
            <p style={{ color: 'var(--text-muted)', maxWidth: '600px', margin: '0 auto' }}>
              Abra esta web dentro de Matriz, local o almacén. Manténgala abierta al salir para que el sistema registre automáticamente la hora de salida.
            </p>
          </>
        )}
      </section>

      {cancelReason !== null && <Modal onClose={() => !submitting && setCancelReason(null)} labelledBy="cancel-delivery-title">
        <h2 id="cancel-delivery-title">Cancelar recorrido</h2>
        <form onSubmit={handleCancel}>
          <label className="form-label" htmlFor="cancel-delivery-reason">Motivo de la incidencia</label>
          <textarea id="cancel-delivery-reason" className="form-input" required minLength={5} maxLength={1000} value={cancelReason} onChange={e => setCancelReason(e.target.value)} />
          <p>El recorrido se cerrará y el motivo quedará en el historial.</p>
          <button type="submit" className="btn btn-danger" disabled={submitting}>Confirmar cancelación</button>
        </form>
      </Modal>}
      <section className="glass-panel" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '1.15rem', marginBottom: '18px', display: 'flex', gap: '8px', alignItems: 'center' }}><Clock size={20} /> Entregas recientes</h2>
        {status.recent.filter((route) => route.estado === 'ENTREGADA').length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Todavía no hay entregas registradas.</p>
        ) : (
          <div className="table-container">
            <table className="premium-table">
              <thead><tr><th>Origen</th><th>Destino</th><th>Salida</th><th>Duración</th></tr></thead>
              <tbody>
                {status.recent.filter((route) => route.estado === 'ENTREGADA').map((route) => (
                  <tr key={route.id}>
                    <td>{route.origen_nombre}</td><td>{route.destino_nombre}</td>
                    <td>{new Date(route.salida_at).toLocaleString('es-EC')}</td>
                    <td><strong>{formatDuration(route.duracion_segundos)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
