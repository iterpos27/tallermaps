const db = require('../src/db');

const run = async () => {
  try {
    await db.initDatabase();
    const result = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM sectores)::integer AS sectores,
        (SELECT COUNT(*) FROM talleres WHERE sector_id IS NOT NULL)::integer AS talleres_sectorizados,
        (SELECT COUNT(*) FROM talleres WHERE tipo = 'TALLER' AND sector_id IS NULL)::integer AS talleres_sin_sector,
        (SELECT COUNT(*) FROM vendedor_sectores)::integer AS asignaciones
    `);
    console.log(JSON.stringify(result.rows[0]));
    if (result.rows[0].talleres_sin_sector > 0) {
      const pending = await db.query(
        `SELECT id, nombre, latitud, longitud, vendedor_asignado_id
         FROM talleres
         WHERE tipo = 'TALLER' AND sector_id IS NULL
         ORDER BY nombre`
      );
      console.log(JSON.stringify({ talleres_pendientes: pending.rows }));
    }
  } finally {
    await db.pool.end();
  }
};

run().catch((error) => {
  console.error('Sector migration failed:', error);
  process.exitCode = 1;
});
