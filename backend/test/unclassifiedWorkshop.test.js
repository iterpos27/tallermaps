const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../src/db');
const { storageService } = require('../src/services/storage');
const { createVisita } = require('../src/controllers/visitaController');

test('un vendedor registra una visita con taller nuevo sin seleccionar sector', async (context) => {
  const originalQuery = db.query;
  const originalConnect = db.pool.connect;
  const originalSaveFile = storageService.saveFile;
  const executedQueries = [];

  context.after(() => {
    db.query = originalQuery;
    db.pool.connect = originalConnect;
    storageService.saveFile = originalSaveFile;
  });

  db.query = async (sql, params = []) => {
    executedQueries.push({ sql, params });
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql) || sql.includes('set_config') || sql.includes('pg_advisory_xact_lock') || sql.includes('client_request_id') && sql.startsWith('SELECT') || sql.includes('latitud BETWEEN')) return { rows: [] };

    if (sql.includes('SELECT id FROM talleres WHERE LOWER(nombre)')) return { rows: [] };
    if (sql.includes('INSERT INTO talleres')) return { rows: [{ id: 81 }] };
    if (sql.includes('FROM programaciones_visita')) return { rows: [] };
    if (sql.includes('INSERT INTO visitas')) {
      return {
        rows: [{
          id: 91,
          taller_id: 81,
          vendedor_id: 12,
          foto_url: '/uploads/prueba.jpg'
        }]
      };
    }

    throw new Error(`Consulta inesperada en la prueba: ${sql}`);
  };
  storageService.saveFile = async () => '/uploads/prueba.jpg';
  db.pool.connect = async () => ({ query: db.query, release() {} });

  const response = {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };

  await createVisita({
    user: { id: 12, role: 'VENDEDOR' },
    body: {
      owner_id: 12,
      client_request_id: 'test-request-123',
      taller_nombre: 'Taller nuevo sin clasificar',
      latitud: '-1.0577',
      longitud: '-80.4558',
      observacion: 'Primera visita registrada correctamente.'
    },
    file: { filename: 'prueba.jpg' }
  }, response);

  const workshopInsert = executedQueries.find(({ sql }) => sql.includes('INSERT INTO talleres'));
  assert.equal(response.statusCode, 201);
  assert.equal(response.payload.visita.taller_id, 81);
  assert.ok(workshopInsert);
  assert.equal(workshopInsert.sql.includes('sector_id'), false);
  assert.deepEqual(workshopInsert.params, [
    'Taller nuevo sin clasificar',
    '-1.0577',
    '-80.4558',
    12,
    'Primera visita registrada correctamente.'
  ]);
});
