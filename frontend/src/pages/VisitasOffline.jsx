import React, { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, Trash2 } from 'lucide-react';
import { api, offlineStorage } from '../api/api';
import AlertBanner from '../components/AlertBanner';
import Modal from '../components/Modal';
import CommercialFields from '../components/CommercialFields';

export default function VisitasOffline() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(null);
  const [editing, setEditing] = useState(null);
  const [workshops, setWorkshops] = useState([]);
  const [busy, setBusy] = useState(false);
  const [unassignedCount, setUnassignedCount] = useState(0);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  const loadVisits = async () => {
    setLoading(true);
    try {
      setVisits(await offlineStorage.getPendingVisits());
      setUnassignedCount(await offlineStorage.getUnassignedCount());
    } catch (loadError) {
      setError(loadError.message || 'No se pudo leer la cola offline.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVisits();
    const updateConnection = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, []);

  const retry = async () => {
    setBusy(true);
    setMessage('Reintentando sincronización...');
    setError('');
    try {
      const result = await offlineStorage.syncPendingVisits(setMessage, { force: true });
      setMessage(`Sincronizadas: ${result.syncedCount}. Requieren revisión: ${result.conflictCount}.`);
      await loadVisits();
    } catch (retryError) {
      setError(retryError.message || 'No se pudo sincronizar la cola.');
    } finally {
      setBusy(false);
    }
  };

  const removeVisit = async () => {
    setBusy(true);
    try {
      await offlineStorage.removePendingVisit(removing.id);
      setRemoving(null);
      setMessage('La visita pendiente fue descartada de este dispositivo.');
      await loadVisits();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const startEditing = async (visit) => {
    setBusy(true);
    try { setWorkshops(await api.talleres.list()); setEditing({ ...visit }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const saveCorrection = async (event) => {
    event.preventDefault();
    if (editing.observacion?.trim().length < 10) { setError('Ingrese al menos 10 caracteres de observación.'); return; }
    setBusy(true);
    try {
      await offlineStorage.updatePendingVisit(editing);
      setEditing(null);
      setMessage('Corrección guardada. La visita se sincronizará al reintentar.');
      await loadVisits();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Visitas sin conexión</h1>
          <p className="page-subtitle">Pendientes guardados en este dispositivo</p>
        </div>
        <button type="button" className="btn btn-primary offline-retry-button" onClick={retry} disabled={loading || busy || !!editing || !isOnline}>
          <RefreshCw size={16} /> Reintentar sincronización
        </button>
      </div>

      <AlertBanner type="success" style={{ marginBottom: '16px' }}>{message}</AlertBanner>
      <AlertBanner style={{ marginBottom: '16px' }}>{error}</AlertBanner>
      {unassignedCount > 0 && <p className="alert alert-warning">Hay {unassignedCount} visita(s) antiguas sin propietario identificado en este dispositivo. Se conservan sin sincronizar; solicite al administrador revisar a quién pertenecen.</p>}

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /><p>Cargando cola offline...</p></div>
      ) : visits.length === 0 ? (
        <div className="glass-panel" style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <CloudOff size={48} style={{ opacity: 0.4, marginBottom: '12px' }} />
          <p>No hay visitas pendientes en este dispositivo.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {visits.map((visit) => (
            <article key={visit.id} className="glass-panel offline-visit-card">
              <div>
                <strong>{visit.taller_nombre || `Taller #${visit.taller_id}`}</strong>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '4px' }}>
                  Guardada: {visit.queuedAt ? new Date(visit.queuedAt).toLocaleString('es-EC') : 'fecha desconocida'} · Intentos: {visit.attempts || 0}
                </p>
                {visit.lastError && <p style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '5px' }}>{visit.lastError}</p>}
              </div>
              {visit.status === 'needs_attention' && <button type="button" className="btn btn-secondary" disabled={busy || !isOnline} onClick={() => startEditing(visit)}>Corregir</button>}
              <button type="button" className="btn btn-danger" disabled={busy} style={{ width: 'auto' }} onClick={() => setRemoving(visit)}>
                <Trash2 size={15} /> Descartar
              </button>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <Modal onClose={() => !busy && setEditing(null)} labelledBy="edit-offline-title" maxWidth="500px">
          <h2 id="edit-offline-title">Corregir visita pendiente</h2>
          <form onSubmit={saveCorrection}>
            <label className="form-label" htmlFor="offline-workshop">Taller</label>
            <select id="offline-workshop" className="form-input" value={editing.taller_id || ''} onChange={(e) => setEditing({ ...editing, taller_id: e.target.value, programacion_id: null, taller_nombre: workshops.find(t => String(t.id) === e.target.value)?.nombre || editing.taller_nombre })}>
              <option value="">Registrar taller nuevo</option>
              {workshops.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
            {!editing.taller_id && <><label className="form-label" htmlFor="offline-name">Nombre del taller nuevo</label><input id="offline-name" className="form-input" required maxLength={255} value={editing.taller_nombre || ''} onChange={e => setEditing({ ...editing, taller_nombre: e.target.value })} /></>}
            <label className="form-label" htmlFor="offline-observation">Observación</label>
            <textarea id="offline-observation" className="form-input" required minLength={10} value={editing.observacion || ''} onChange={e => setEditing({ ...editing, observacion: e.target.value })} />
            {editing.programacion_id && <label><input type="checkbox" onChange={() => setEditing({ ...editing, programacion_id: null })} /> Desvincular programación rechazada</label>}
            <CommercialFields value={editing} onChange={setEditing} disabled={busy} />
            <p>La fotografía, ubicación y hora de captura se conservan. No se permiten talleres nuevos a 5 metros o menos de otro registrado.</p>
            <button type="submit" className="btn btn-primary" disabled={busy}>Guardar corrección</button>
          </form>
        </Modal>
      )}
      {removing && (
        <Modal onClose={() => setRemoving(null)} labelledBy="remove-offline-title" maxWidth="430px">
          <h2 id="remove-offline-title" style={{ fontSize: '1.1rem', marginBottom: '10px' }}>¿Descartar visita pendiente?</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Esta acción elimina la visita de este dispositivo y no se puede recuperar.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setRemoving(null)}>Cancelar</button>
            <button className="btn btn-danger" disabled={busy} style={{ width: 'auto' }} onClick={removeVisit}>Sí, descartar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
