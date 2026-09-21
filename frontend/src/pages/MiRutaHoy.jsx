import { useEffect, useState } from 'react';
import { CalendarDays, Clock3, MapPin, RefreshCw } from 'lucide-react';
import { api } from '../api/api';
import { businessDate } from '../utils/date';

const labels = {PENDIENTE:'Pendiente',EN_CAMINO:'En camino',INICIADA:'Iniciada',EJECUTADA:'Realizada',FALLIDA:'No realizada',REPROGRAMADA:'Reprogramada',CANCELADA:'Cancelada'};
export default function MiRutaHoy() {
  const [stops,setStops]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const load=async()=>{setLoading(true);setError('');try{const date=businessDate();setStops(await api.programaciones.list({fecha_inicio:date,fecha_fin:date}));}catch(e){setError(e.message);}finally{setLoading(false);}};
  useEffect(()=>{load();},[]);
  return <div>
    <div className="page-header field-hero"><div><h1 className="page-title">Mi ruta de hoy</h1><p className="page-subtitle">Su agenda del día, en orden. Registre la evidencia desde Registrar visita.</p></div><button className="btn btn-secondary" disabled={loading} onClick={load}><RefreshCw size={17}/>Actualizar</button></div>
    {error&&<p role="alert" className="alert alert-danger">{error}</p>}
    <div className="field-summary"><span><strong>{stops.length}</strong> visitas programadas</span><span><strong>{stops.filter(s=>s.estado==='EJECUTADA').length}</strong> realizadas</span></div>
    {loading?<p role="status">Cargando agenda…</p>:!stops.length?<div className="glass-panel permission-empty"><CalendarDays size={38}/><h2>Su agenda está libre</h2><p>No tiene visitas programadas para hoy.</p></div>:<div className="field-route-list">{stops.map((stop,index)=><article className="glass-panel field-route-card" key={stop.id}><span className="field-route-number">{stop.orden_ruta||index+1}</span><div><span className={`route-status route-status-${stop.estado.toLowerCase()}`}>{labels[stop.estado]||stop.estado}</span><h2>{stop.taller_nombre}</h2><p><MapPin size={15}/>{stop.taller_direccion||stop.sector_nombre||'Taller registrado'}</p>{stop.observacion&&<p>{stop.observacion}</p>}</div><span className="field-route-time"><Clock3 size={16}/>{String(stop.hora_programada).slice(0,5)}</span></article>)}</div>}
  </div>;
}
