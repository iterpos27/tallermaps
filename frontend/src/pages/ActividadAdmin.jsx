import React, { useEffect, useState } from 'react';
import { Activity, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { api } from '../api/api';
import AlertBanner from '../components/AlertBanner';

const ACTION_LABELS = {
  talleres_UPDATE: 'Taller actualizado',
  talleres_DELETE: 'Taller eliminado definitivamente',
  visitas_UPDATE: 'Visita actualizada',
  visitas_DELETE: 'Visita eliminada',
  compromisos_UPDATE: 'Compromiso actualizado',
  compromisos_DELETE: 'Compromiso eliminado',
  DUPLICADOS_REVISADOS: 'Talleres cercanos revisados',
  TALLERES_UNIFICADOS: 'Historial de talleres unificado',
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

const FIELD_LABELS = {nombre:'Nombre',fecha_visita:'Fecha de visita',captured_at:'Fecha de captura',observacion:'Observación',observaciones:'Observaciones',resultado:'Resultado',descripcion:'Compromiso',fecha:'Fecha de gestión',estado:'Estado',cierre:'Nota de cierre',is_active:'Activo',deleted_at:'Fecha de archivo',deleted_by:'Usuario que archivó',updated_at:'Última modificación',vendedor_id:'ID vendedor',taller_id:'ID taller',merged_into_id:'Taller que conserva el historial'};
function AuditDetails({ details }) {
  if(Array.isArray(details?.antes)) return <span>Origen #{details.source_id} → Destino #{details.target_id}. {details.motivo}</span>;
  if(!details?.antes) return details?.nombre || details?.username || details?.taller || details?.motivo || '—';
  const before=details.antes,after=details.despues || {};
  const value=v=>v==null?'Sin valor':typeof v==='boolean'?(v?'Sí':'No'):String(v);
  return <details><summary>Ver valores anteriores y nuevos</summary><div style={{maxWidth:420,whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{Object.keys(before).filter(key=>before[key]!==after[key]).map(key=><p key={key} style={{marginTop:8}}><strong>{FIELD_LABELS[key] || key.replaceAll('_',' ')}</strong><br />Antes: {value(before[key])}<br />Después: {value(after[key])}</p>)}</div></details>;
}

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
                <p>Cambios de talleres, visitas, usuarios y compromisos</p>
              </div>
            </div>
            <span className="activity-total">{data.total} {data.total === 1 ? 'registro' : 'registros'}</span>
          </div>

          <div className="activity-table-scroll">
            <table className="premium-table activity-table">
              <thead>
                <tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Entidad</th><th>Detalle</th><th>IP</th></tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td className="activity-date">{new Date(item.created_at).toLocaleString('es-EC')}</td>
                    <td><strong>{item.user_name || item.username || 'Sistema'}</strong></td>
                    <td><span className={`activity-badge activity-badge-${getActionTone(item.action)}`}>{ACTION_LABELS[item.action] || item.action}</span></td>
                    <td><span className="activity-entity">{item.entity_type} #{item.entity_id || '—'}</span></td>
                    <td><AuditDetails details={item.details} /></td>
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
