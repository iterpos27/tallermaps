const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Execute the actual client module with an in-memory storage/network boundary.
// No browser credentials, IndexedDB records or live endpoints are used.
const client = (visits, reply) => {
  let user = { id: 1, role: 'VENDEDOR' };
  const saved = new Map(visits.map(v => [v.id, { ...v }]));
  const requests = [];
  const source = fs.readFileSync(path.join(__dirname, '../../frontend/src/api/api.js'), 'utf8')
    .replace(/import\s*\{[\s\S]*?\}\s*from '\.\.\/storage\/offlineVisits';/, '')
    .replaceAll('import.meta.env', '({})').replaceAll('export const ', 'const ');
  const context = {
    window: { location: { origin: 'http://test.invalid' } }, navigator: {},
    sessionStorage: { getItem: () => user ? JSON.stringify(user) : null, removeItem: () => { user = null; } },
    localStorage: { removeItem() {} },
    console: { error() {} }, URLSearchParams, FormData, File, Blob, Date,
    getPendingOfflineVisits: async () => [...saved.values()],
    savePendingOfflineVisit: async (v) => { saved.set(v.id, v); return v; },
    updatePendingOfflineVisit: async (v) => saved.set(v.id, v),
    removePendingOfflineVisit: async (id) => saved.delete(id),
    fetch: async (url, options) => {
      requests.push(options.body);
      const status = reply ? reply(options.body) : 201;
      return { ok: status < 400, status, json: async () => ({ error: 'Prueba de rechazo' }) };
    }
  };
  vm.runInNewContext(`${source}\nglobalThis.result = offlineStorage;`, context);
  return { storage: context.result, saved, requests, setUser: (value) => { user = value; } };
};
const pending = (id, owner_id = 1) => ({ id, owner_id, taller_id: 10, latitud: -1, longitud: -80,
  observacion: 'Observaciones de prueba', captured_at: '2026-01-02T01:00:00Z', photoBlob: new Blob(['photo'], { type:'image/jpeg' }) });

test('cola offline separa propietarios y no sincroniza registros antiguos sin dueño', async () => {
  const ctx = client([pending('first-visit'), pending('other-visit', 2), pending('legacy-visit', null)]);
  assert.equal((await ctx.storage.getPendingVisits()).length,1);
  await ctx.storage.syncPendingVisits();
  assert.equal(ctx.requests.length,1);
  assert.equal(ctx.requests[0].get('owner_id'),'1');
  assert.equal(ctx.requests[0].get('client_request_id'),'first-visit');
  assert.equal(ctx.requests[0].get('captured_at'),'2026-01-02T01:00:00Z');
  assert.equal(ctx.saved.has('other-visit'),true);
  assert.equal(ctx.saved.has('legacy-visit'),true);
  ctx.setUser({id:2,role:'VENDEDOR'});
  assert.equal((await ctx.storage.getPendingVisits())[0].id,'other-visit');
});
test('un conflicto 403 no bloquea otra visita y puede corregirse', async () => {
  const ctx=client([pending('rejected-visit'),pending('valid-visit')],form=>form.get('client_request_id')==='rejected-visit'?403:201);
  const result=await ctx.storage.syncPendingVisits();
  assert.equal(result.conflictCount,1);
  assert.equal(result.syncedCount,1);
  assert.equal(ctx.saved.get('rejected-visit').status,'needs_attention');
  await ctx.storage.updatePendingVisit({...ctx.saved.get('rejected-visit'),taller_id:20,observacion:'Observación corregida'});
  assert.equal(ctx.saved.get('rejected-visit').status,'pending');
  assert.equal(ctx.saved.get('rejected-visit').taller_id,20);
  assert.equal(ctx.saved.get('rejected-visit').captured_at,'2026-01-02T01:00:00Z');
});
test('sincronizaciones simultáneas comparten una sola operación', async () => {
  const ctx=client([pending('only-one')]);
  await Promise.all([ctx.storage.syncPendingVisits(),ctx.storage.syncPendingVisits()]);
  assert.equal(ctx.requests.length,1);
});
