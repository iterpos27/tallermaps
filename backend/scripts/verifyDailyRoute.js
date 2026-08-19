const db = require('../src/db');

const run = async () => {
  const [columns, constraint] = await Promise.all([
    db.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'programaciones_visita'
         AND column_name IN ('orden_ruta', 'iniciada_at', 'finalizada_at', 'motivo_fallo')
       ORDER BY column_name`
    ),
    db.query(
      `SELECT pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
       WHERE conname = 'programaciones_visita_estado_check'`
    )
  ]);
  const expectedColumns = ['finalizada_at', 'iniciada_at', 'motivo_fallo', 'orden_ruta'];
  const actualColumns = columns.rows.map((row) => row.column_name);
  const definition = constraint.rows[0]?.definition || '';
  if (JSON.stringify(actualColumns) !== JSON.stringify(expectedColumns)) {
    throw new Error(`Faltan columnas de ruta diaria: ${actualColumns.join(', ')}`);
  }
  for (const state of ['EN_CAMINO', 'INICIADA', 'FALLIDA', 'REPROGRAMADA']) {
    if (!definition.includes(state)) throw new Error(`El estado ${state} no está habilitado en la base de datos.`);
  }
  console.log(JSON.stringify({ columns: actualColumns, route_states_ready: true }));
};

run()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
