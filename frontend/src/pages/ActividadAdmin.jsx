import React, { useEffect, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { api } from '../api/api';
import AlertBanner from '../components/AlertBanner';

const ACTION_LABELS = {
  TALLER_ARCHIVADO: 'Taller eliminado',
  TALLER_RESTAURADO: 'Taller restaurado',
  TALLER_CREADO: 'Taller creado',
  TALLER_ACTUALIZADO: 'Taller actualizado',
  USUARIO_CREADO: 'Usuario creado',
  USUARIO_ACTUALIZADO: 'Usuario actualizado',
  VISITA_ELIMINADA: 'Visita eliminada',
  CONTRASENA_ACTUALIZADA: 'Contraseña actualizada'
};

const getActionTone = (action) => {
  if (action.includes('ARCHIVADO') || action.includes('ELIMINADA')) return 'danger';
  if (action.includes('CREADO') || action.includes('RESTAURADO')) return 'success';
  return 'primary';
};

export default function ActividadAdmin() {
  const [data, setData] = useState({ items: [], total: 0, page: 1, limit: 25 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadActivity = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await api.audit.list({ page, limit: 25 }));
    } catch (requestError) {
      setError(requestError.message || 'No se pudo cargar la actividad administrativa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadActivity();
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title">Actividad</h1>
          <p className="page-subtitle">Historial de cambios del sistema</p>
        </div>
        <button type="button" className="btn btn-secondary" style={{ width: 'auto' }} onClick={loadActivity} disabled={loading}>
          <RefreshCw size={16} /> Actualizar
        </button>
      </div>

      <AlertBanner style={{ marginBottom: '20px' }}>{error}</AlertBanner>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /><p>Cargando actividad...</p></div>
      ) : data.items.length === 0 ? (
        <div className="glass-panel" style={{ padding: '50px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
          <Activity size={46} style={{ opacity: 0.45, marginBottom: '10px' }} />
          <p>Aún no existen actividades registradas.</p>
        </div>
      ) : (
        <div className="glass-panel activity-panel">
          <div className="activity-panel-header">
            <div className="activity-panel-title">
              <span className="activity-icon"><Activity size={20} /></span>
              <div>
                <h2>Historial de cambios</h2>
                <p>Acciones sensibles realizadas por los administradores</p>
              </div>
            </div>
            <span className="activity-total">{data.total} {data.total === 1 ? 'registro' : 'registros'}</span>
          </div>

          <div className="activity-table-scroll">
            <table className="premium-table activity-table">
              <thead>
                <tr><th>Fecha</th><th>Administrador</th><th>Acción</th><th>Entidad</th><th>Detalle</th><th>IP</th></tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="activity-date">{new Date(item.created_at).toLocaleString('es-EC')}</td>
                    <td><strong>{item.user_name || item.username || 'Sistema'}</strong></td>
                    <td><span className={`activity-badge activity-badge-${getActionTone(item.action)}`}>{ACTION_LABELS[item.action] || item.action}</span></td>
                    <td><span className="activity-entity">{item.entity_type} #{item.entity_id || '—'}</span></td>
                    <td>{item.details?.nombre || item.details?.username || item.details?.taller || '—'}</td>
                    <td><code className="activity-ip">{item.ip_address || '—'}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '18px' }}>
          <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setPage((current) => current - 1)} disabled={page === 1}><ChevronLeft size={16} /> Anterior</button>
          <span>Página {page} de {totalPages}</span>
          <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setPage((current) => current + 1)} disabled={page === totalPages}>Siguiente <ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  );
}
