import React, { useEffect, useState } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { offlineStorage } from '../api/api';
import AlertBanner from '../components/AlertBanner';

export default function VisitasOffline() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
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

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Visitas sin conexión</h1>
          <p className="page-subtitle">Pendientes guardados en este dispositivo</p>
        </div>
        <button type="button" className="btn btn-primary offline-retry-button" onClick={retry} disabled={loading || busy || !isOnline}>
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
              {visit.status === 'needs_attention' && <p className="offline-review-note">Solicite al administrador revisar esta visita desde este dispositivo. Sus datos se conservan.</p>}
            </article>
          ))}
        </div>
      )}

    </div>
  );
}
