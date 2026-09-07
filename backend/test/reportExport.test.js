const test = require('node:test');
const assert = require('node:assert/strict');

test('semana de lunes a domingo incluso al cambiar de año', async () => {
  const { weekRange } = await import('../../frontend/src/utils/reportExport.mjs');
  assert.deepEqual(weekRange('2026-01-01'), { fecha_inicio: '2025-12-29', fecha_fin: '2026-01-04' });
  assert.deepEqual(weekRange('2026-01-04'), weekRange('2026-01-01'));
  assert.deepEqual(weekRange('2026-01-05'), { fecha_inicio: '2026-01-05', fecha_fin: '2026-01-11' });
});

test('CSV conserva acentos, comillas y saltos, y neutraliza fórmulas', async () => {
  const { reportCsv } = await import('../../frontend/src/utils/reportExport.mjs');
  const csv = reportCsv([{ tipo: 'VISITA', taller_id: 1, taller: '=1+1', observaciones: 'Revisión; "motor"\nNueva línea', fecha: '2026-03-08 23:59:59', responsable: 'José' }]);
  assert.ok(csv.startsWith('\uFEFF'));
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"Revisión; ""motor""\nNueva línea"'));
  assert.ok(csv.includes('"José"'));
});
