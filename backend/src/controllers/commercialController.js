const db = require('../db');
const { transaction, rejectRequest } = require('../services/transactions');
const { distanceMeters } = require('../services/workshopGeofence');
const { sellerCanAccessWorkshop } = require('../services/sectorAccess');
const { normalizeDate, businessDate } = require('../utils/validation');
const wrap = fn => async (req,res) => {
  try { await fn(req,res); } catch (e) {
    if (!e.status) console.error('Commercial operation failed:', e);
    res.status(e.status || 500).json({ error: e.status ? e.message : 'No se pudo completar la operación.' });
  }
};
exports.list = wrap(async (req,res) => {
  const result = await db.query(`SELECT c.*, to_char(c.fecha,'YYYY-MM-DD') AS fecha,
    t.nombre AS taller, u.name AS vendedor FROM compromisos c
    JOIN talleres t ON t.id=c.taller_id JOIN users u ON u.id=c.vendedor_id
    WHERE ($1='ADMIN' OR c.vendedor_id=$2)
    ORDER BY CASE WHEN c.estado='PENDIENTE' THEN 0 ELSE 1 END,c.fecha,c.id`,[req.user.role,req.user.id]);
  res.json(result.rows);
});
exports.close = wrap(async (req,res) => {
  const { estado, cierre } = req.body;
  if (!['COMPLETADO','CANCELADO'].includes(estado) || typeof cierre !== 'string' || cierre.trim().length < 10 || cierre.length > 2000) throw rejectRequest(400,'Indique estado y una nota de cierre de 10 a 2000 caracteres.');
  const result = await transaction(async client => {
    const row = (await client.query('SELECT * FROM compromisos WHERE id=$1 FOR UPDATE',[req.params.id])).rows[0];
    if (!row || (req.user.role !== 'ADMIN' && row.vendedor_id !== req.user.id)) throw rejectRequest(404,'Compromiso no encontrado.');
    if (row.estado !== 'PENDIENTE') throw rejectRequest(409,'El compromiso ya fue cerrado.');
    return (await client.query('UPDATE compromisos SET estado=$1,cierre=$2,updated_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING *',[estado,cierre.trim(),row.id])).rows[0];
  },req.user.id);
  res.json(result);
});
exports.create = wrap(async (req,res) => {
  const { taller_id, descripcion, fecha } = req.body;
  const vendedor = req.user.role === 'ADMIN' ? req.body.vendedor_id : req.user.id;
  if (!/^[1-9]\d*$/.test(String(taller_id)) || !/^[1-9]\d*$/.test(String(vendedor)) || !normalizeDate(fecha) || fecha < businessDate()
    || typeof descripcion !== 'string' || descripcion.trim().length < 10 || descripcion.length > 2000) throw rejectRequest(400,'Seleccione taller, vendedor, fecha actual o futura y compromiso de 10 a 2000 caracteres.');
  const result = await transaction(async client => {
    if (!(await client.query("SELECT id FROM users WHERE id=$1 AND role='VENDEDOR' AND is_active=TRUE",[vendedor])).rows.length) throw rejectRequest(400,'Vendedor no disponible.');
    if (!await sellerCanAccessWorkshop(client,vendedor,taller_id)) throw rejectRequest(403,'El taller no está asignado a ese vendedor.');
    return (await client.query('INSERT INTO compromisos(taller_id,vendedor_id,descripcion,fecha) VALUES($1,$2,$3,$4) RETURNING *',[taller_id,vendedor,descripcion.trim(),fecha])).rows[0];
  },req.user.id);
  res.status(201).json(result);
});
exports.metrics = wrap(async (req,res) => {
  const { fecha_inicio,fecha_fin } = req.query;
  if (!fecha_inicio || !fecha_fin) throw rejectRequest(400,'Seleccione un rango de fechas.');
  const result = await db.query(`SELECT u.id,u.name,
    (SELECT count(*)::int FROM visitas v WHERE v.vendedor_id=u.id AND v.fecha_visita >= $1::date AND v.fecha_visita < $2::date+1) AS visitas,
    (SELECT count(DISTINCT taller_id)::int FROM visitas v WHERE v.vendedor_id=u.id AND v.fecha_visita >= $1::date AND v.fecha_visita < $2::date+1) AS talleres_visitados,
    (SELECT count(*)::int FROM visitas v WHERE v.vendedor_id=u.id AND v.resultado='VENTA' AND v.fecha_visita >= $1::date AND v.fecha_visita < $2::date+1) AS ventas,
    (SELECT count(*)::int FROM visitas v WHERE v.vendedor_id=u.id AND v.fuera_rango AND v.fecha_visita >= $1::date AND v.fecha_visita < $2::date+1) AS fuera_rango,
    (SELECT count(*)::int FROM talleres t WHERE t.created_by=u.id AND t.tipo='TALLER' AND t.created_at >= $1::date AND t.created_at < $2::date+1) AS nuevos,
    (SELECT count(*)::int FROM programaciones_visita p WHERE p.vendedor_id=u.id AND p.estado<>'CANCELADA' AND p.fecha_programada BETWEEN $1::date AND $2::date) AS programadas,
    (SELECT count(*)::int FROM programaciones_visita p WHERE p.vendedor_id=u.id AND p.estado='EJECUTADA' AND p.fecha_programada BETWEEN $1::date AND $2::date) AS ejecutadas
    FROM users u WHERE u.role='VENDEDOR' OR EXISTS(SELECT 1 FROM visitas v WHERE v.vendedor_id=u.id) ORDER BY u.name`,[fecha_inicio,fecha_fin]);
  res.json(result.rows);
});
exports.duplicates = wrap(async (req,res) => {
  const result = await db.query(`SELECT a.id AS a_id,a.nombre AS a_nombre,a.latitud AS a_lat,a.longitud AS a_lon,
    b.id AS b_id,b.nombre AS b_nombre,b.latitud AS b_lat,b.longitud AS b_lon,
    r.motivo,r.reviewed_at
    FROM talleres a JOIN talleres b ON a.id<b.id AND b.latitud BETWEEN a.latitud-0.00046 AND a.latitud+0.00046
    LEFT JOIN revisiones_duplicados r ON r.taller_a=a.id AND r.taller_b=b.id
    WHERE a.tipo='TALLER' AND b.tipo='TALLER' AND a.is_active AND b.is_active`);
  res.json(result.rows.map(row => ({...row,distancia:distanceMeters(row.a_lat,row.a_lon,row.b_lat,row.b_lon)})).filter(row=>row.distancia<=50));
});
exports.reviewDuplicate = wrap(async (req,res) => {
  const { taller_a,taller_b,motivo } = req.body;
  if (![taller_a,taller_b].every(id => /^[1-9]\d*$/.test(String(id))) || Number(taller_a)>=Number(taller_b) || typeof motivo !== 'string' || motivo.trim().length<10 || motivo.length>2000) throw rejectRequest(400,'Seleccione dos talleres y un motivo de al menos 10 caracteres.');
  await transaction(async client => {
    const rows = (await client.query("SELECT * FROM talleres WHERE id IN ($1,$2) AND tipo='TALLER' AND is_active FOR UPDATE",[taller_a,taller_b])).rows;
    if (rows.length!==2 || distanceMeters(rows[0].latitud,rows[0].longitud,rows[1].latitud,rows[1].longitud)>50) throw rejectRequest(409,'Los talleres ya no forman un par cercano activo.');
    await client.query(`INSERT INTO revisiones_duplicados(taller_a,taller_b,motivo,reviewed_by) VALUES($1,$2,$3,$4)
      ON CONFLICT(taller_a,taller_b) DO UPDATE SET motivo=EXCLUDED.motivo,reviewed_by=EXCLUDED.reviewed_by,reviewed_at=CURRENT_TIMESTAMP`,[taller_a,taller_b,motivo.trim(),req.user.id]);
    await require('../services/audit').logActivity({req,client,action:'DUPLICADOS_REVISADOS',entityType:'taller',entityId:taller_a,details:{taller_b,motivo:motivo.trim()}});
  },req.user.id);
  res.json({message:'Revisión guardada. No se modificaron talleres ni visitas.'});
});
exports.merge = wrap(async (req,res) => {
  const { source_id,target_id,motivo }=req.body;
  if(![source_id,target_id].every(id=>/^[1-9]\d*$/.test(String(id))) || Number(source_id)===Number(target_id) || typeof motivo!=='string' || motivo.trim().length<10 || motivo.length>2000) throw rejectRequest(400,'Seleccione origen, destino y motivo de al menos 10 caracteres.');
  await transaction(async client=>{
    // Use the same order as visit/schedule writes: seller, then workshop.
    const users=(await client.query('SELECT id FROM users ORDER BY id')).rows;
    for(const user of users) await client.query('SELECT pg_advisory_xact_lock(74003,$1::integer)',[user.id]);
    await client.query('SELECT pg_advisory_xact_lock(74001)');
    const rows=(await client.query("SELECT * FROM talleres WHERE id IN ($1,$2) AND tipo='TALLER' AND is_active ORDER BY id FOR UPDATE",[source_id,target_id])).rows;
    if(rows.length!==2 || distanceMeters(rows[0].latitud,rows[0].longitud,rows[1].latitud,rows[1].longitud)>50) throw rejectRequest(409,'Solo se pueden unificar dos talleres activos a 50 metros o menos.');
    const conflict=await client.query(`SELECT 1 FROM programaciones_visita a JOIN programaciones_visita b
      ON a.vendedor_id=b.vendedor_id AND a.fecha_programada=b.fecha_programada AND a.hora_programada=b.hora_programada
      WHERE a.taller_id=$1 AND b.taller_id=$2 LIMIT 1`,[source_id,target_id]);
    if(conflict.rows.length) throw rejectRequest(409,'Hay programaciones con el mismo vendedor, fecha y hora. Reprográmelas antes de unificar.');
    await client.query('UPDATE visitas SET taller_id=$1 WHERE taller_id=$2',[target_id,source_id]);
    await client.query('UPDATE programaciones_visita SET taller_id=$1 WHERE taller_id=$2',[target_id,source_id]);
    await client.query('UPDATE compromisos SET taller_id=$1,updated_at=CURRENT_TIMESTAMP WHERE taller_id=$2',[target_id,source_id]);
    await client.query('UPDATE talleres SET is_active=FALSE,deleted_at=CURRENT_TIMESTAMP,deleted_by=$1,merged_into_id=$2 WHERE id=$3',[req.user.id,target_id,source_id]);
    await require('../services/audit').logActivity({req,client,action:'TALLERES_UNIFICADOS',entityType:'taller',entityId:target_id,details:{source_id,target_id,motivo:motivo.trim(),antes:rows}});
  },req.user.id);
  res.json({message:'Historial unificado. La ficha de origen permanece archivada para auditoría.'});
});
