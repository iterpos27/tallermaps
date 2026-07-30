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
  CONTRASENA_ACTUALIZADA: 'Contraseña actualizada'
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
          <h1 className="page-title">Actividad Administrativa</h1>
          <p className="page-subtitle">Registro auditable de cambios sensibles realizados en el sistema</p>
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
        <div className="glass-panel" style={{ overflowX: 'auto', padding: 0 }}>
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th>Fecha</th><th>Administrador</th><th>Acción</th><th>Entidad</th><th>Detalle</th><th>IP</th></tr></thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.created_at).toLocaleString('es-EC')}</td>
                  <td>{item.user_name || item.username || 'Sistema'}</td>
                  <td><strong>{ACTION_LABELS[item.action] || item.action}</strong></td>
                  <td>{item.entity_type} #{item.entity_id || '—'}</td>
                  <td>{item.details?.nombre || item.details?.username || '—'}</td>
                  <td>{item.ip_address || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
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
