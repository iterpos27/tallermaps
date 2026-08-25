import React, { useEffect, useState } from 'react';
import { CloudOff, RefreshCw, Trash2 } from 'lucide-react';
import { offlineStorage } from '../api/api';
import AlertBanner from '../components/AlertBanner';
import Modal from '../components/Modal';

export default function VisitasOffline() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(null);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  const loadVisits = async () => {
    setLoading(true);
    try {
      setVisits(await offlineStorage.getPendingVisits());
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
    setMessage('Reintentando sincronización...');
    setError('');
    try {
      const result = await offlineStorage.syncPendingVisits(setMessage, { force: true });
      setMessage(`Sincronizadas: ${result.syncedCount}. Requieren revisión: ${result.conflictCount}.`);
      await loadVisits();
    } catch (retryError) {
      setError(retryError.message || 'No se pudo sincronizar la cola.');
    }
  };

  const removeVisit = async () => {
    await offlineStorage.removePendingVisit(removing.id);
    setRemoving(null);
    setMessage('La visita pendiente fue descartada de este dispositivo.');
    await loadVisits();
  };

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Visitas sin conexión</h1>
          <p className="page-subtitle">Pendientes guardados en este dispositivo</p>
        </div>
        <button type="button" className="btn btn-primary offline-retry-button" onClick={retry} disabled={loading || !isOnline}>
          <RefreshCw size={16} /> Reintentar sincronización
        </button>
      </div>

      <AlertBanner type="success" style={{ marginBottom: '16px' }}>{message}</AlertBanner>
      <AlertBanner style={{ marginBottom: '16px' }}>{error}</AlertBanner>

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
              <button type="button" className="btn btn-danger" style={{ width: 'auto' }} onClick={() => setRemoving(visit)}>
                <Trash2 size={15} /> Descartar
              </button>
            </article>
          ))}
        </div>
      )}

      {removing && (
        <Modal onClose={() => setRemoving(null)} labelledBy="remove-offline-title" maxWidth="430px">
          <h2 id="remove-offline-title" style={{ fontSize: '1.1rem', marginBottom: '10px' }}>¿Descartar visita pendiente?</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Esta acción elimina la visita de este dispositivo y no se puede recuperar.</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setRemoving(null)}>Cancelar</button>
            <button className="btn btn-danger" style={{ width: 'auto' }} onClick={removeVisit}>Sí, descartar</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
