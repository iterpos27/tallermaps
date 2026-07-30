const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, '../backups'));
const pgDumpCommand = process.env.PG_DUMP_PATH || 'pg_dump';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputPath = path.join(backupDir, `tallervisitas-${timestamp}.dump`);

fs.mkdirSync(backupDir, { recursive: true });

const args = ['--format=custom', '--no-owner', '--no-privileges', '--file', outputPath];
const backupEnvironment = {
  ...process.env,
  PGDATABASE: process.env.DATABASE_URL || process.env.PGDATABASE || 'tallervisitas_db'
};

const child = spawn(pgDumpCommand, args, {
  stdio: 'inherit',
  env: backupEnvironment,
  shell: false
});

child.on('error', (error) => {
  console.error(`No se pudo ejecutar pg_dump: ${error.message}`);
  process.exitCode = 1;
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log(`Respaldo creado: ${outputPath}`);
  } else {
    console.error(`pg_dump terminó con código ${code}.`);
    process.exitCode = code || 1;
  }
});
