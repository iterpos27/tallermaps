const { initDatabase, pool } = require('../src/db');

const run = async () => {
  try {
    await initDatabase();
    const result = await pool.query(
      'SELECT version, description, applied_at FROM schema_migrations ORDER BY applied_at, version'
    );
    console.log('Migraciones aplicadas:');
    result.rows.forEach((migration) => {
      console.log(`- ${migration.version}: ${migration.description}`);
    });
  } finally {
    await pool.end();
  }
};

run().catch((error) => {
  console.error('No se pudieron aplicar las migraciones:', error);
  process.exitCode = 1;
});
