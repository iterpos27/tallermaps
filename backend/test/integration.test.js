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
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const app = express();
  app.use(express.json());
  for (const [route, file] of [['visitas','visita'],['talleres','taller'],['programaciones','programacion'],['users','user'],['entregas','entrega']]) {
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
  await t.test('rechaza nuevos talleres a 49/50 m, permite 51 m y protege ediciones', async () => {
    first = await workshop('Punto base', -1);
    assert.equal(first.status, 201, JSON.stringify(first));
    const offset = m => -1 + m / 6371000 * 180 / Math.PI;
    for (const m of [49, 50]) assert.equal((await workshop(`Cerca ${m}`, offset(m))).status, 409);
    const far = await workshop('Fuera 51', offset(51));
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
