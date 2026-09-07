import React, { useEffect, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { api } from '../api/api';
import AlertBanner from '../components/AlertBanner';
import { weekRange, reportCsv } from '../utils/reportExport.mjs';

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export default function Reportes() {
  const [mode, setMode] = useState('semana');
  const [day, setDay] = useState(today);
  const [range, setRange] = useState(() => weekRange(today()));
  const [seller, setSeller] = useState('');
  const [users, setUsers] = useState([]);
  const [rows, setRows] = useState(null);
  const [loadedFilters, setLoadedFilters] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [metrics,setMetrics] = useState([]);
  const [exporting,setExporting] = useState(false);
  const filters = { ...(mode === 'semana' ? weekRange(day) : range), vendedor_id: seller };
  const valid = filters.fecha_inicio && filters.fecha_fin && filters.fecha_inicio <= filters.fecha_fin;
  const current = JSON.stringify(filters) === JSON.stringify(loadedFilters);

  useEffect(() => {
    api.users.list().then(setUsers).catch(e => setError(e.message));
  }, []);

  async function generate(event) {
    event.preventDefault();
    if (!valid || loading) return;
    setLoading(true);
    setError('');
    setRows(null);
    try {
      const [result,indicators] = await Promise.all([api.visitas.reporte(filters),api.comercial.metrics(filters)]);
      setMetrics(indicators.filter(m=>!seller || String(m.id)===seller));
      setRows(result);
      setLoadedFilters(filters);
      setPage(1);
    } catch (e) {
      setError(e.message || 'No se pudo generar el reporte.');
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!current || !rows?.length || loading) return;
    const url = URL.createObjectURL(new Blob([reportCsv(rows)], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `reporte_talleres_${loadedFilters.fecha_inicio}_${loadedFilters.fecha_fin}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function documentDownload(format) {
    if (!current || !rows?.length || exporting) return;
    setExporting(true);setError('');
    try {
      const {reportWorkbook,reportPdf}=await import('../utils/reportDocuments.mjs');
      const description={...loadedFilters,responsable_nombre:users.find(u=>String(u.id)===seller)?.name};
      const data=format==='xlsx'?await reportWorkbook(rows,description,metrics):await reportPdf(rows,description);
      const url=URL.createObjectURL(new Blob([data],{type:format==='xlsx'?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/pdf'}));
      const a=document.createElement('a');a.href=url;a.download=`reporte_${loadedFilters.fecha_inicio}_${loadedFilters.fecha_fin}.${format}`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }catch(e){setError(e.message || 'No se pudo descargar el archivo.');}finally{setExporting(false);}
  }

  const visits = rows?.filter(row => row.tipo === 'VISITA') || [];
  const created = rows?.filter(row => row.tipo === 'CREACION') || [];
  const pages = Math.max(1, Math.ceil((rows?.length || 0) / 50));
  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Reportes</h1><p className="page-subtitle">Talleres visitados y creados por período</p></div>
        <button className="btn btn-primary" type="button" style={{ width: 'auto' }} onClick={download} disabled={loading || !current || !rows?.length}>
          <Download size={18} /> Descargar CSV
        </button>
      </div>
      <form className="glass-panel" style={{ padding: 20, marginBottom: 20 }} onSubmit={generate}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
          <label>Período<select className="form-input" value={mode} onChange={e => setMode(e.target.value)} disabled={loading}>
            <option value="semana">Por semana</option><option value="rango">Rango de fechas</option>
          </select></label>
          {mode === 'semana' ? <label>Seleccione un día de la semana<input className="form-input" type="date" required value={day} onChange={e => setDay(e.target.value)} disabled={loading} /></label> : <>
            <label>Desde<input className="form-input" type="date" required value={range.fecha_inicio} max={range.fecha_fin || undefined} onChange={e => setRange({ ...range, fecha_inicio: e.target.value })} disabled={loading} /></label>
            <label>Hasta<input className="form-input" type="date" required value={range.fecha_fin} min={range.fecha_inicio || undefined} onChange={e => setRange({ ...range, fecha_fin: e.target.value })} disabled={loading} /></label>
          </>}
          <label>Vendedor<select className="form-input" value={seller} onChange={e => setSeller(e.target.value)} disabled={loading}>
            <option value="">Todos los responsables</option>
            {users.map(user => <option key={user.id} value={user.id}>{user.name}{user.role !== 'VENDEDOR' ? ` (${user.role})` : ''}</option>)}
          </select></label>
          <button className="btn btn-primary" style={{ width: 'auto' }} disabled={!valid || loading}><Search size={18} /> {loading ? 'Generando…' : 'Generar reporte'}</button>
        </div>
        <p style={{ marginTop: 14, color: 'var(--text-muted)' }}>Del {filters.fecha_inicio || '—'} al {filters.fecha_fin || '—'}, ambos inclusive. Semanas de lunes a domingo. Horario de Ecuador.</p>
      </form>
      <AlertBanner>{error}</AlertBanner>
      <div style={{display:'flex',gap:12,marginBottom:16}}>{[['xlsx','Descargar Excel'],['pdf','Descargar PDF']].map(([format,label])=><button key={format} className="btn btn-secondary" style={{width:'auto'}} disabled={loading||exporting||!current||!rows?.length} onClick={()=>documentDownload(format)}>{exporting?'Preparando…':label}</button>)}</div>
      {rows && !current && <p role="status">Los filtros cambiaron. Genere el reporte para actualizar los resultados y la descarga.</p>}
      {rows && current && <>
        <h2 style={{fontSize:18,marginBottom:12}}>Indicadores por vendedor</h2>
        <div className="glass-panel" style={{overflowX:'auto',marginBottom:20}}><table className="premium-table"><thead><tr>{['Vendedor','Visitas','Talleres visitados','Nuevos','Ventas','Fuera de geocerca','Cumplimiento'].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{metrics.map(m=><tr key={m.id}><td>{m.name}</td><td>{m.visitas}</td><td>{m.talleres_visitados}</td><td>{m.nuevos}</td><td>{m.ventas}</td><td>{m.fuera_rango}</td><td>{m.programadas?`${Math.round(m.ejecutadas/m.programadas*100)}% (${m.ejecutadas}/${m.programadas})`:'Sin agenda'}</td></tr>)}</tbody></table></div>
        <p style={{ marginBottom: 16 }}><strong>{visits.length}</strong> visitas · <strong>{new Set(visits.map(row => row.taller_id)).size}</strong> talleres visitados · <strong>{created.length}</strong> talleres creados</p>
        <div className="glass-panel" style={{ overflowX: 'auto' }}>
          <table className="premium-table">
            <thead><tr>{['Tipo', 'Taller', 'Observaciones', 'Fecha y hora', 'Vendedor / creador'].map(title => <th key={title} scope="col">{title}</th>)}</tr></thead>
            <tbody>{rows.length === 0 ? <tr><td colSpan={5}>No hay visitas ni talleres creados en este período.</td></tr> : rows.slice((page - 1) * 50, page * 50).map(row => <tr key={`${row.tipo}-${row.id}`}>
              <td>{row.tipo === 'VISITA' ? 'Taller visitado' : 'Taller creado'}</td><td>{row.taller}</td>
              <td style={{ whiteSpace: 'pre-wrap', minWidth: 220, overflowWrap: 'anywhere' }}>{row.observaciones || 'Sin observaciones'}</td>
              <td style={{ whiteSpace: 'nowrap' }}>{row.fecha}</td><td>{row.responsable || 'Sin registro'}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {pages > 1 && <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 16 }}>
          <button className="btn btn-secondary" style={{ width: 'auto' }} disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button>
          <span>Página {page} de {pages}</span>
          <button className="btn btn-secondary" style={{ width: 'auto' }} disabled={page === pages} onClick={() => setPage(page + 1)}>Siguiente</button>
        </div>}
        <p style={{ marginTop: 16, color: 'var(--text-muted)' }}>La descarga incluye todas las filas. Cada visita y cada creación tienen una fila independiente. Las altas usan la fecha de registro en el sistema; las visitas, su fecha de realización. Los creadores históricos no identificados aparecen como “Sin registro”.</p>
      </>}
    </div>
  );
}
