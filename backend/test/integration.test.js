const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

test('API y PostgreSQL: validaciones, concurrencia y transacciones', { skip: !process.env.QA_PG_PORT }, async (t) => {
  process.env.JWT_SECRET = 'isolated-test-session-secret';
  process.env.UPLOAD_DIR = path.resolve(__dirname, '../../artifacts/qa-uploads');
  const { Pool } = require('pg');
  const db = require('../src/db');
  const originalPool = db.pool;
  const schema = `qa_${randomUUID().replaceAll('-', '')}`;
  const config = { host: '127.0.0.1', port: Number(process.env.QA_PG_PORT), user: 'postgres', database: 'postgres' };
  const setup = new Pool(config);
  await setup.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ ...config, options: `-c search_path=${schema} -c timezone=America/Guayaquil` });
  db.pool = pool;
  db.query = (...args) => pool.query(...args);
  await pool.query(fs.readFileSync(path.join(__dirname, '../src/db/schema.sql'), 'utf8'));
  const migration = fs.readFileSync(path.join(__dirname, '../src/db/migrations/002_functional_validation.sql'), 'utf8');
  await pool.query(migration);
  await pool.query(migration); // Migration is safe to retry.
  const reportMigration = fs.readFileSync(path.join(__dirname, '../src/db/migrations/003_reports.sql'), 'utf8');
  await pool.query(reportMigration);
  await pool.query(reportMigration);
  const commercialMigration=fs.readFileSync(path.join(__dirname,'../src/db/migrations/004_commercial.sql'),'utf8');
  await pool.query(commercialMigration);
  await pool.query(commercialMigration);
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const app = express();
  app.use(express.json());
  for (const [route, file] of [['comercial','commercial'],['visitas','visita'],['talleres','taller'],['programaciones','programacion'],['users','user'],['entregas','entrega']]) {
    app.use(`/api/${route}`, require(`../src/routes/${file}Routes`));
  }
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await pool.end();
    // Only this test's freshly generated schema is removed.
    assert.match(schema, /^qa_[a-f0-9]{32}$/);
    await setup.query(`DROP SCHEMA ${schema} CASCADE`);
    await setup.end();
    await originalPool.end();
  });
  const users = (await pool.query(`INSERT INTO users (name,email,username,password_hash,role) VALUES
    ('Admin','qaadmin@example.test','qaadmin','unused','ADMIN'),
    ('Seller','qaseller@example.test','qaseller','unused','VENDEDOR'),
    ('Other','qaother@example.test','qaother','unused','VENDEDOR'),
    ('Messenger','qamessenger@example.test','qamessenger','unused','MENSAJERO') RETURNING *`)).rows;
  const [admin, seller, other, messenger] = users;
  const token = user => jwt.sign({ id: user.id, role: user.role, session_version: 0 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const api = async (user, method, url, data) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${url}`, {
      method, headers: { Authorization: `Bearer ${typeof user === 'string' ? user : token(user)}`, ...(data instanceof FormData ? {} : { 'Content-Type': 'application/json' }) },
      body: data === undefined ? undefined : data instanceof FormData ? data : JSON.stringify(data)
    });
    return { status: response.status, body: await response.json() };
  };
  const workshop = async (name, lat, lon = -80, user = seller) => api(user, 'POST', '/talleres', { nombre: name, latitud: lat, longitud: lon });
  const visitForm = (values = {}) => {
    const form = new FormData();
    const body = { owner_id: seller.id, client_request_id: randomUUID(), latitud: -1, longitud: -80, observacion: 'Prueba de visita con datos válidos', captured_at: '2026-01-02T01:00:00Z', ...values };
    for (const [key,value] of Object.entries(body)) form.append(key, value);
    form.append('foto', new Blob(['test image'], { type: 'image/jpeg' }), 'test.jpg');
    return form;
  };
  let first;
  await t.test('resultado y compromiso son atómicos, idempotentes y privados', async () => {
    const key=randomUUID();
    const form=()=>visitForm({taller_nombre:'Taller seguimiento QA',latitud:-20,resultado:'SEGUIMIENTO',compromiso:'Enviar cotización de repuestos',proxima_fecha:'2026-01-03',client_request_id:key});
    const saved=await api(seller,'POST','/visitas',form());
    assert.equal(saved.status,201,JSON.stringify(saved));
    assert.equal(saved.body.visita.resultado,'SEGUIMIENTO');
    assert.equal((await api(seller,'POST','/visitas',form())).status,200);
    const list=await api(seller,'GET','/comercial/compromisos');
    assert.equal(list.body.length,1);
    assert.equal((await api(other,'GET','/comercial/compromisos')).body.length,0);
    assert.equal((await api(messenger,'GET','/comercial/compromisos')).status,403);
    const commitment=list.body[0];
    assert.equal((await api(other,'PUT',`/comercial/compromisos/${commitment.id}`,{estado:'COMPLETADO',cierre:'Cierre sin autorización'})).status,404);
    assert.equal((await api(seller,'PUT',`/comercial/compromisos/${commitment.id}`,{estado:'COMPLETADO',cierre:'Cotización enviada al cliente'})).status,200);
    assert.equal((await api(seller,'PUT',`/comercial/compromisos/${commitment.id}`,{estado:'COMPLETADO',cierre:'Intento repetido de cierre'})).status,409);
    const audit=(await pool.query("SELECT * FROM activity_logs WHERE action='compromisos_UPDATE' AND entity_id=$1",[String(commitment.id)])).rows[0];
    assert.equal(audit.user_id,seller.id);assert.equal(audit.details.antes.estado,'PENDIENTE');assert.equal(audit.details.despues.estado,'COMPLETADO');
    for(const values of [{resultado:'INVALIDO'},{resultado:'SEGUIMIENTO'},{resultado:'SEGUIMIENTO',compromiso:'Enviar cotización de prueba',proxima_fecha:'2025-12-31'}]) {
      assert.equal((await api(seller,'POST','/visitas',visitForm({taller_nombre:'No crear',latitud:-21,...values}))).status,400);
    }
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM talleres WHERE nombre='No crear'")).rows[0].n,0);
    const metrics=await api(admin,'GET','/comercial/indicadores?fecha_inicio=2026-01-01&fecha_fin=2026-01-03');
    assert.equal(metrics.status,200);assert.equal(metrics.body.find(m=>m.id===seller.id).visitas,1);
    assert.equal((await api(seller,'GET','/comercial/indicadores?fecha_inicio=2026-01-01&fecha_fin=2026-01-03')).status,403);
    assert.equal((await api(seller,'PUT',`/visitas/${saved.body.visita.id}/fecha`,{fecha:'2026-01-02',hora:'10:30'})).status,200);
    const changed=(await pool.query("SELECT * FROM activity_logs WHERE action='visitas_UPDATE' AND entity_id=$1",[String(saved.body.visita.id)])).rows[0];
    assert.equal(changed.user_id,seller.id);assert.ok(changed.details.antes.fecha_visita!==changed.details.despues.fecha_visita);
  });
  await t.test('revisión de duplicados antiguos no altera sus visitas', async () => {
    const pair=(await pool.query("INSERT INTO talleres(nombre,latitud,longitud) VALUES('Legacy A',-30,-80),('Legacy B',-30.0001,-80) RETURNING id")).rows;
    const pairs=await api(admin,'GET','/comercial/duplicados');
    assert.equal(pairs.status,200);assert.ok(pairs.body.some(p=>p.a_id===pair[0].id&&p.b_id===pair[1].id));
    const review={taller_a:pair[0].id,taller_b:pair[1].id,motivo:'Dos negocios distintos en locales contiguos'};
    assert.equal((await api(seller,'POST','/comercial/duplicados',review)).status,403);
    assert.equal((await api(admin,'POST','/comercial/duplicados',review)).status,200);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM talleres WHERE id IN ($1,$2) AND is_active',pair.map(p=>p.id))).rows[0].n,2);
    await pool.query("INSERT INTO visitas(taller_id,vendedor_id,foto_url,latitud,longitud,observacion) VALUES($1,$2,'qa',-30,-80,'Visita histórica para unificar')",[pair[1].id,seller.id]);
    const merge={source_id:pair[1].id,target_id:pair[0].id,motivo:'Mismo taller registrado dos veces en el pasado'};
    assert.equal((await api(seller,'POST','/comercial/unificar',merge)).status,403);
    for(const point of pair) await pool.query("INSERT INTO programaciones_visita(taller_id,vendedor_id,fecha_programada,hora_programada) VALUES($1,$2,'2026-10-01','09:00')",[point.id,seller.id]);
    assert.equal((await api(admin,'POST','/comercial/unificar',merge)).status,409);
    assert.equal((await pool.query('SELECT is_active FROM talleres WHERE id=$1',[pair[1].id])).rows[0].is_active,true);
    await pool.query('DELETE FROM programaciones_visita WHERE taller_id=$1',[pair[1].id]);
    assert.equal((await api(admin,'POST','/comercial/unificar',merge)).status,200);
    const archived=(await pool.query('SELECT is_active,merged_into_id FROM talleres WHERE id=$1',[pair[1].id])).rows[0];
    assert.equal(archived.is_active,false);assert.equal(archived.merged_into_id,pair[0].id);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM visitas WHERE taller_id=$1',[pair[0].id])).rows[0].n,1);
    assert.equal((await api(admin,'POST',`/talleres/${pair[1].id}/restore`,{})).status,404);
  });
  await t.test('reportes: límites inclusivos, creador, filtros y permisos', async () => {
    const created = await workshop('Reporte taller', -15);
    const id = created.body.taller.id;
    assert.equal((await pool.query('SELECT created_by FROM talleres WHERE id=$1', [id])).rows[0].created_by, seller.id);
    await pool.query("UPDATE talleres SET created_at='2026-03-02 00:00:00', observaciones='Alta de prueba' WHERE id=$1", [id]);
    for (const date of ['2026-03-01 23:59:59', '2026-03-02 00:00:00', '2026-03-08 23:59:59', '2026-03-09 00:00:00']) {
      await pool.query('INSERT INTO visitas(taller_id,vendedor_id,foto_url,latitud,longitud,fecha_visita,observacion) VALUES($1,$2,\'qa\',-15,-80,$3,\'Observación de prueba\')', [id,seller.id,date]);
    }
    const url = '/visitas/reporte?fecha_inicio=2026-03-02&fecha_fin=2026-03-08';
    const report = await api(admin,'GET',url);
    assert.equal(report.status,200);
    assert.equal(report.body.length,3);
    assert.equal(report.body.filter(r => r.tipo === 'VISITA').length,2);
    assert.ok(report.body.every(r => r.responsable === seller.name));
    assert.equal((await api(admin,'GET',`${url}&vendedor_id=${other.id}`)).body.length,0);
    assert.equal((await api(seller,'GET',url)).status,403);
    assert.equal((await api(messenger,'GET',url)).status,403);
    assert.equal((await api(admin,'GET','/visitas/reporte')).status,400);
    assert.equal((await api(admin,'GET','/visitas/reporte?fecha_inicio=2026-03-09&fecha_fin=2026-03-02')).status,400);
    assert.equal((await api(admin,'GET','/visitas/reporte?fecha_inicio=2026-02-30&fecha_fin=2026-03-02')).status,400);
    await pool.query('UPDATE talleres SET created_by=NULL WHERE id=$1',[id]);
    const legacy = await api(admin,'GET',url);
    assert.equal(legacy.body.find(r => r.tipo === 'CREACION').responsable,null);
    await pool.query('DELETE FROM visitas WHERE taller_id=$1',[id]);
    await pool.query('DELETE FROM talleres WHERE id=$1',[id]);
  });
  await t.test('rechaza nuevos talleres a 4/5 m, permite 6 m y protege ediciones', async () => {
    first = await workshop('Punto base', -1);
    assert.equal(first.status, 201, JSON.stringify(first));
    const offset = m => -1 + m / 6371000 * 180 / Math.PI;
    for (const m of [4, 5]) assert.equal((await workshop(`Cerca ${m}`, offset(m))).status, 409);
    const far = await workshop('Fuera 6', offset(6));
    assert.equal(far.status, 201, JSON.stringify(far));
    assert.equal((await api(admin,'PUT',`/talleres/${far.body.taller.id}`, { nombre: 'Movido', latitud: -1, longitud: -80 })).status, 409);
    assert.equal((await api(admin,'PUT',`/talleres/${first.body.taller.id}`, { nombre: 'Base editada', latitud: -1, longitud: -80 })).status, 200);
  });
  await t.test('dos altas simultáneas cercanas crean un único taller', async () => {
    const results = await Promise.all([workshop('Concurrente A', -2), workshop('Concurrente B', -2)]);
    assert.deepEqual(results.map(r => r.status).sort(), [201,409]);
  });
  await t.test('geocerca también cubre mensajeros y talleres archivados', async () => {
    assert.equal((await workshop('Mensajero duplicado', -1, -80, messenger)).status,409);
    const archived = await workshop('Archivable', -3);
    await api(admin,'DELETE',`/talleres/${archived.body.taller.id}`);
    assert.equal((await workshop('Recreado', -3)).status,409);
    assert.equal((await api(admin,'POST',`/talleres/${archived.body.taller.id}/restore`, {})).status,200);
  });
  await t.test('mensajero no consulta visitas ni cambia agenda ajena', async () => {
    assert.equal((await api(messenger,'GET','/visitas')).status,403);
    assert.equal((await api(messenger,'PUT','/programaciones/1',{ estado:'PENDIENTE' })).status,403);
  });
  await t.test('creador accede a taller sin clasificar; otro vendedor no', async () => {
    const created = await workshop('Pendiente sector', -4);
    assert.equal((await api(seller,'GET',`/talleres/${created.body.taller.id}`)).status,200);
    assert.equal((await api(other,'GET',`/talleres/${created.body.taller.id}`)).status,404);
  });
  let scheduled;
  await t.test('agenda rechaza cruces al reactivar, fechas imposibles y concurrencia', async () => {
    const data = { taller_id:first.body.taller.id, fecha_programada:'2026-09-10', hora_programada:'10:00', duracion_minutos:30 };
    // Restore creator assignment removed by the administrative edit.
    await pool.query('UPDATE talleres SET vendedor_asignado_id=$1 WHERE id=$2',[seller.id,first.body.taller.id]);
    scheduled=await api(seller,'POST','/programaciones',data);
    assert.equal(scheduled.status,201,JSON.stringify(scheduled));
    const id=scheduled.body.programacion.id;
    assert.equal((await api(seller,'PUT',`/programaciones/${id}`,{ fecha_programada:'2026-02-30' })).status,400);
    assert.equal((await api(seller,'PUT',`/programaciones/${id}`,{ estado:'CANCELADA' })).status,200);
    assert.equal((await api(seller,'POST','/programaciones',{...data,hora_programada:'10:15'})).status,201);
    assert.equal((await api(seller,'PUT',`/programaciones/${id}`,{ estado:'PENDIENTE' })).status,409);
    const results=await Promise.all(['11:00','11:15'].map(hora_programada=>api(seller,'POST','/programaciones',{...data,hora_programada})));
    assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  });
  await t.test('visita se guarda una vez al reintentar y conserva la hora de captura', async () => {
    const key=randomUUID();
    const body={taller_id:first.body.taller.id,client_request_id:key};
    const results=await Promise.all([api(seller,'POST','/visitas',visitForm(body)),api(seller,'POST','/visitas',visitForm(body))]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,201],JSON.stringify(results));
    assert.equal(results[0].body.visita.id,results[1].body.visita.id);
    assert.equal(results[0].body.visita.fecha_visita, '2026-01-02T01:00:00.000Z');
    const stored=(await pool.query("SELECT to_char(fecha_visita,'YYYY-MM-DD HH24:MI') AS captured FROM visitas WHERE client_request_id=$1",[key])).rows[0];
    assert.equal(stored.captured,'2026-01-01 20:00');
    const listed=await api(seller,'GET','/visitas?fecha_inicio=2026-01-01&fecha_fin=2026-01-01');
    assert.equal(listed.status,200);
    assert.equal(listed.body.find(v=>v.id===results[0].body.visita.id).fecha_visita,'2026-01-02T01:00:00.000Z');
    assert.equal((await api(other,'POST','/visitas',visitForm(body))).status,403);
  });
  await t.test('registro desde visita bloquea talleres cercanos y revierte taller con programación inválida', async () => {
    assert.equal((await api(seller,'POST','/visitas',visitForm({taller_nombre:'Duplicado desde visita'}))).status,409);
    assert.equal((await api(seller,'POST','/visitas',visitForm({taller_nombre:'Debe revertirse',latitud:-5,programacion_id:999999}))).status,400);
    assert.equal((await pool.query("SELECT id FROM talleres WHERE nombre='Debe revertirse'")).rows.length,0);
  });
  await t.test('una programación ejecutada no vuelve a consumirse', async () => {
    const scheduled=await api(seller,'POST','/programaciones',{taller_id:first.body.taller.id,fecha_programada:'2026-09-11',hora_programada:'09:00',duracion_minutos:30});
    const body={taller_id:first.body.taller.id,programacion_id:scheduled.body.programacion.id};
    assert.equal((await api(seller,'POST','/visitas',visitForm(body))).status,201);
    assert.equal((await api(seller,'POST','/visitas',visitForm(body))).status,409);
  });
  await t.test('no se desactiva al último administrador', async () => {
    assert.equal((await api(admin,'PUT',`/users/${admin.id}`,{ name:admin.name,email:admin.email,username:admin.username,role:'ADMIN',is_active:false })).status,409);
  });
  await t.test('actualizar rol por API revoca el token anterior', async () => {
    const updated=await api(admin,'PUT',`/users/${other.id}`,{name:other.name,email:other.email,username:other.username,role:'MENSAJERO',is_active:true});
    assert.equal(updated.status,200,JSON.stringify(updated));
    assert.equal((await api(other,'GET','/visitas')).status,401);
    await pool.query("UPDATE users SET role='VENDEDOR',session_version=0 WHERE id=$1",[other.id]);
  });
  await t.test('falla al finalizar programación revierte visita y conserva programación pendiente', async () => {
    const planned=await api(seller,'POST','/programaciones',{taller_id:first.body.taller.id,fecha_programada:'2026-09-12',hora_programada:'09:00',duracion_minutos:30});
    const id=planned.body.programacion.id;
    await pool.query(`CREATE FUNCTION reject_qa_schedule() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id=${Number(id)} THEN RAISE EXCEPTION 'simulated finalization failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER qa_schedule_failure BEFORE UPDATE ON programaciones_visita FOR EACH ROW EXECUTE FUNCTION reject_qa_schedule()`);
    const key=randomUUID();
    assert.equal((await api(seller,'POST','/visitas',visitForm({taller_id:first.body.taller.id,programacion_id:id,client_request_id:key}))).status,500);
    assert.equal((await pool.query('SELECT id FROM visitas WHERE client_request_id=$1',[key])).rows.length,0);
    assert.equal((await pool.query('SELECT estado FROM programaciones_visita WHERE id=$1',[id])).rows[0].estado,'PENDIENTE');
    await pool.query('DROP TRIGGER qa_schedule_failure ON programaciones_visita');
  });
  await t.test('desactivación, cambios de rol y contraseña revocan sesiones', async () => {
    const old=token(other);
    await pool.query('UPDATE users SET is_active=FALSE WHERE id=$1',[other.id]);
    assert.equal((await api(old,'GET','/visitas')).status,401);
    await pool.query('UPDATE users SET is_active=TRUE,role=\'MENSAJERO\' WHERE id=$1',[other.id]);
    assert.equal((await api(old,'GET','/visitas')).status,403);
    assert.equal((await api(admin,'PUT',`/users/${other.id}/password`,{password:'NewPass123'})).status,200);
    assert.equal((await api(old,'GET','/visitas')).status,401);
    const expired=jwt.sign({id:seller.id},process.env.JWT_SECRET,{expiresIn:-1});
    assert.equal((await api(expired,'GET','/visitas')).status,401);
  });
  await t.test('entregas exigen precisión GPS y permiten cancelar con historial', async () => {
    assert.equal((await api(messenger,'POST','/entregas/complete',{latitud:-1,longitud:-80})).status,400);
    assert.equal((await api(messenger,'POST','/entregas/position',{latitud:-1,longitud:-80,accuracy:500})).status,400);
    await pool.query('INSERT INTO entregas_recorridos (mensajero_id,origen_id,salida_latitud,salida_longitud) VALUES ($1,$2,-1,-80)',[messenger.id,first.body.taller.id]);
    assert.equal((await api(messenger,'POST','/entregas/cancel',{motivo:'Entrega no recibida'})).status,200);
    const cancelled=(await pool.query('SELECT estado,motivo_cancelacion FROM entregas_recorridos WHERE mensajero_id=$1',[messenger.id])).rows[0];
    assert.equal(cancelled.estado,'CANCELADA');
    assert.equal(cancelled.motivo_cancelacion,'Entrega no recibida');
  });
});
