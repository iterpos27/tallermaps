import React, { useEffect, useState } from 'react';
import { api, getUser } from '../api/api';
import { businessDate } from '../utils/date';
import AlertBanner from '../components/AlertBanner';
import Modal from '../components/Modal';
import { RESULTS } from '../components/CommercialFields';
import { getPhotoUrl, handlePhotoError } from '../utils/photo';

export default function Seguimiento() {
  const admin = getUser()?.role === 'ADMIN';
  const [tab,setTab] = useState('compromisos');
  const [items,setItems] = useState([]);
  const [workshops,setWorkshops] = useState([]);
  const [users,setUsers] = useState([]);
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  const [filter,setFilter] = useState('PENDIENTE');
  const [closing,setClosing] = useState(null);
  const [note,setNote] = useState('');
  const [history,setHistory] = useState([]);
  const [selected,setSelected] = useState('');
  const [duplicates,setDuplicates] = useState([]);
  const [review,setReview] = useState(null);
  const [merge,setMerge]=useState(null);
  const [backup,setBackup] = useState(null);
  const [form,setForm] = useState({taller_id:'',vendedor_id:'',fecha:businessDate(),descripcion:''});
  const [showForm,setShowForm] = useState(false);
  async function refresh() {
    setBusy(true); setError('');
    try {
      const [commitments,places,people,pairs] = await Promise.all([api.comercial.list(),api.talleres.list({includeDeleted:admin}),admin?api.users.list():[],admin?api.comercial.duplicates():[]]);
      setItems(commitments);setWorkshops(places);setUsers(people);setDuplicates(pairs);
      if(admin) setBackup(await api.comercial.backups());
    } catch(e) {setError(e.message);} finally {setBusy(false);}
  }
  useEffect(()=>{refresh();},[]);
  useEffect(()=>{
    let active=true;
    setHistory([]);
    if(selected) api.talleres.visitas(selected).then(data=>{if(active)setHistory(data);}).catch(e=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[selected]);
  async function save(event) {
    event.preventDefault();setBusy(true);setError('');
    try {
      if(closing) await api.comercial.close(closing.id,{estado:closing.estado,cierre:note});
      else if(merge) await api.comercial.merge({...merge,motivo:note});
      else if(review) await api.comercial.review({taller_a:review.a_id,taller_b:review.b_id,motivo:note});
      else await api.comercial.create(form);
      setClosing(null);setReview(null);setMerge(null);setShowForm(false);setNote('');
      setForm({taller_id:'',vendedor_id:'',fecha:businessDate(),descripcion:''});
      await refresh();
    } catch(e){setError(e.message);} finally{setBusy(false);}
  }
  const overdue=items.filter(c=>c.estado==='PENDIENTE'&&c.fecha<businessDate());
  const visible=items.filter(c=>filter==='TODOS'||(filter==='VENCIDOS'?c.estado==='PENDIENTE'&&c.fecha<businessDate():c.estado===filter));
  const workshop=workshops.find(t=>String(t.id)===selected);
  const card={padding:20,marginBottom:16};
  return <div>
    <div className="page-header"><div><h1 className="page-title">Seguimiento comercial</h1><p className="page-subtitle">Compromisos e historial de cada taller</p></div><button className="btn btn-secondary" style={{width:'auto'}} disabled={busy} onClick={refresh}>Actualizar</button></div>
    <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:20}}>{[['compromisos','Compromisos'],['historial','Ficha del taller'],...(admin?[['duplicados','Revisar duplicados']]:[])].map(([key,title])=><button className={`btn btn-${tab===key?'primary':'secondary'}`} style={{width:'auto'}} key={key} onClick={()=>setTab(key)}>{title}</button>)}</div>
    <AlertBanner>{error}</AlertBanner>
    {admin&&backup&&<details style={{marginBottom:20}}><summary>Estado de respaldos</summary><p>{backup.enabled?`Automático cada ${backup.intervalHours} horas`:'Automático desactivado'} · {backup.running?'En ejecución':`Último respaldo: ${backup.lastSuccess?new Date(backup.lastSuccess).toLocaleString('es-EC'):'Sin respaldo registrado'}`}</p><p>Última verificación de recuperación: {backup.lastVerification?new Date(backup.lastVerification).toLocaleString('es-EC'):'Pendiente'}</p>{backup.lastError&&<AlertBanner>{backup.lastError}</AlertBanner>}</details>}
    {busy&&<p role="status">Cargando…</p>}
    {tab==='compromisos'&&<>
      <p style={{marginBottom:16}}><strong>{overdue.length}</strong> compromisos vencidos · <strong>{items.filter(c=>c.estado==='PENDIENTE').length}</strong> pendientes</p>
      <div style={{display:'flex',gap:16,marginBottom:16}}><label>Estado<select className="form-input" value={filter} onChange={e=>setFilter(e.target.value)}>{['PENDIENTE','VENCIDOS','COMPLETADO','CANCELADO','TODOS'].map(s=><option key={s}>{s}</option>)}</select></label><button className="btn btn-primary" style={{width:'auto'}} onClick={()=>{setShowForm(true);setError('');}}>Nuevo compromiso</button></div>
      {!visible.length&&!busy&&<p>No hay compromisos para este filtro.</p>}
      {visible.map(c=><article key={c.id} className="glass-panel" style={card}><h2 style={{fontSize:18}}>{c.taller}</h2><p>{c.fecha} · {c.vendedor} · {c.estado}{c.estado==='PENDIENTE'&&c.fecha<businessDate()?' · VENCIDO':''}</p><p style={{whiteSpace:'pre-wrap',margin:'12px 0'}}>{c.descripcion}</p>{c.cierre&&<p>Cierre: {c.cierre}</p>}
        {c.estado==='PENDIENTE'&&<div style={{display:'flex',gap:10}}>{[['COMPLETADO','Completar'],['CANCELADO','Cancelar']].map(([estado,label])=><button key={estado} className="btn btn-secondary" style={{width:'auto'}} disabled={busy} onClick={()=>{setClosing({...c,estado});setNote('');setError('');}}>{label}</button>)}</div>}
      </article>)}
    </>}
    {tab==='historial'&&<>
      <label>Taller<select className="form-input" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Seleccione un taller</option>{workshops.map(t=><option key={t.id} value={t.id}>{t.nombre}{t.is_active===false?' (archivado)':''}</option>)}</select></label>
      {workshop&&<section className="glass-panel" style={{...card,marginTop:20}}><h2>{workshop.nombre}</h2><p>{workshop.propietario || 'Sin propietario registrado'} · {workshop.telefono || 'Sin teléfono'}</p><p>{workshop.direccion || 'Sin dirección'} · {workshop.sector || 'Sin sector'}</p><p style={{whiteSpace:'pre-wrap'}}>{workshop.observaciones}</p><h3 style={{marginTop:20}}>Compromisos</h3>{items.filter(c=>String(c.taller_id)===selected).map(c=><p key={c.id}>{c.fecha} · {c.vendedor} · {c.estado}: {c.descripcion}{c.cierre?` — ${c.cierre}`:''}</p>)}
        <h3 style={{marginTop:20}}>Visitas ({history.length})</h3>{history.map(v=><article key={v.id} style={{borderTop:'1px solid #ddd',padding:'16px 0'}}><strong>{v.vendedor_nombre} · {new Date(v.fecha_visita).toLocaleString('es-EC',{timeZone:'America/Guayaquil'})}</strong><p>{RESULTS[v.resultado] || 'Sin registro'}{v.fuera_rango?' · Fuera de geocerca':''}</p><p style={{whiteSpace:'pre-wrap'}}>{v.observacion}</p><a href={getPhotoUrl(v.foto_url)} target="_blank" rel="noreferrer"><img src={getPhotoUrl(v.foto_url)} onError={handlePhotoError} alt={`Evidencia de visita ${v.id}`} style={{width:160,height:120,objectFit:'cover',marginTop:8}} /></a></article>)}
      </section>}
    </>}
    {tab==='duplicados'&&admin&&<><p style={{marginBottom:16}}>Talleres activos a 50 metros o menos. Revise las fichas antes de decidir si son el mismo negocio. Guardar la revisión conserva todos los datos.</p>{!duplicates.length&&!busy&&<p>No se encontraron pares cercanos.</p>}{duplicates.map(d=><article className="glass-panel" style={card} key={`${d.a_id}-${d.b_id}`}><h3>{d.a_nombre} / {d.b_nombre}</h3><p>{d.distancia.toFixed(1)} metros</p>{d.motivo&&<p>Revisión: {d.motivo}</p>}<div style={{display:'flex',gap:10,flexWrap:'wrap'}}>{[[d.a_id,d.a_nombre],[d.b_id,d.b_nombre]].map(([id,name])=><button className="btn btn-secondary" style={{width:'auto'}} key={id} onClick={()=>{setSelected(String(id));setTab('historial');}}>Ver {name}</button>)}<button className="btn btn-primary" style={{width:'auto'}} onClick={()=>{setReview(d);setNote(d.motivo||'');setError('');}}>Guardar revisión</button><button className="btn btn-secondary" style={{width:"auto"}} onClick={()=>{setMerge({source_id:d.b_id,target_id:d.a_id});setNote("");setError("");}}>Unificar historial</button></div></article>)}</>}
    {(closing||review||merge||showForm)&&<Modal onClose={()=>{if(!busy){setClosing(null);setReview(null);setMerge(null);setShowForm(false);}}} labelledBy="commercial-modal-title"><h2 id="commercial-modal-title">{closing?'Cerrar compromiso':merge?'Confirmar unificación':review?'Revisar talleres cercanos':'Nuevo compromiso'}</h2><AlertBanner>{error}</AlertBanner><form onSubmit={save}>{merge&&<><p>Se conservarán los datos y el sector del taller elegido. Las visitas, fotos, programaciones y compromisos se asociarán a él. La otra ficha quedará archivada y no podrá restaurarse directamente.</p><label>Conservar taller<select className="form-input" value={merge.target_id} onChange={()=>setMerge({...merge,target_id:merge.source_id,source_id:merge.target_id})}><option value={merge.target_id}>{workshops.find(t=>Number(t.id)===Number(merge.target_id))?.nombre}</option><option value={merge.source_id}>{workshops.find(t=>Number(t.id)===Number(merge.source_id))?.nombre}</option></select></label><p>Los responsables de compromisos se mantienen. La operación se rechazará si hay programaciones incompatibles.</p></>}
      {showForm?<><label>Taller<select className="form-input" required value={form.taller_id} onChange={e=>setForm({...form,taller_id:e.target.value})}><option value="">Seleccione</option>{workshops.filter(t=>t.is_active!==false).map(t=><option value={t.id} key={t.id}>{t.nombre}</option>)}</select></label>{admin&&<label>Responsable<select className="form-input" required value={form.vendedor_id} onChange={e=>setForm({...form,vendedor_id:e.target.value})}><option value="">Seleccione</option>{users.filter(u=>u.role==='VENDEDOR'&&u.is_active).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></label>}<label>Fecha<input className="form-input" type="date" required min={businessDate()} value={form.fecha} onChange={e=>setForm({...form,fecha:e.target.value})} /></label><label>Compromiso<textarea className="form-input" required minLength={10} maxLength={2000} value={form.descripcion} onChange={e=>setForm({...form,descripcion:e.target.value})} /></label></>:<label>{closing?`Nota de cierre (${closing.estado})`:'Conclusión de la revisión'}<textarea className="form-input" required minLength={10} maxLength={2000} value={note} onChange={e=>setNote(e.target.value)} /></label>}
      <button className="btn btn-primary" style={{marginTop:16}} disabled={busy}>Guardar</button>
    </form></Modal>}
  </div>;
}
