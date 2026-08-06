const { Pool, Client } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { validatePassword } = require('../utils/validation');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL;

const sslConfig = process.env.DB_SSL === 'true' || (isProduction && connectionString)
  ? { rejectUnauthorized: false }
  : false;

// Managed Postgres providers such as Railway/Render provide DATABASE_URL.
// Local development can keep using PG* vars.
const dbConfig = connectionString
  ? {
      connectionString,
      ssl: sslConfig
    }
  : {
      host: process.env.PGHOST || 'localhost',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'admin',
      port: parseInt(process.env.PGPORT || '5432', 10),
    };

const mainDbName = process.env.PGDATABASE || 'tallervisitas_db';

// Create pool connected to the target database
const pool = new Pool({
  ...dbConfig,
  ...(connectionString ? {} : { database: mainDbName })
});

/**
 * Initializes the database, tables and seeds initial users if they do not exist
 */
async function initDatabase() {
  if (connectionString) {
    await initializeSchema(pool);
    return;
  }

  // Step 1: Ensure database exists
  const client = new Client({
    ...dbConfig,
    database: 'postgres' // connect to default database first
  });

  try {
    await client.connect();
    
    // Check if target database exists
    const dbCheckRes = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [mainDbName]
    );

    if (dbCheckRes.rowCount === 0) {
      console.log(`Database '${mainDbName}' does not exist. Creating...`);
      // CREATE DATABASE cannot run inside a transaction, so we execute it on a separate client
      await client.query(`CREATE DATABASE ${mainDbName}`);
      console.log(`Database '${mainDbName}' created successfully.`);
    } else {
      console.log(`Database '${mainDbName}' already exists.`);
    }
  } catch (error) {
    console.error("Error checking/creating database:", error);
    throw error;
  } finally {
    await client.end();
  }

  // Step 2: Initialize schema tables
  const dbClient = new Client({
    ...dbConfig,
    database: mainDbName
  });

  await initializeSchema(dbClient, true);
}

async function initializeSchema(dbClient, shouldConnect = false) {
  try {
    if (shouldConnect) {
      await dbClient.connect();
    }

    // Check if tables already exist (by checking if 'users' table exists)
    const tableCheckRes = await dbClient.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      );
    `);

    const tablesExist = tableCheckRes.rows[0].exists;

    if (!tablesExist) {
      console.log("Tables do not exist. Executing schema.sql...");
      const schemaPath = path.join(__dirname, 'schema.sql');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      
      await dbClient.query(schemaSql);
      console.log("Schema tables created successfully.");

      // Step 3: Seed the initial administrator from environment configuration.
      console.log("Seeding initial administrator...");
      const salt = await bcrypt.genSalt(10);

      const initialAdminPassword = process.env.INITIAL_ADMIN_PASSWORD || (isProduction ? '' : 'Admin12345');
      const initialAdminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@tallervisitas.com';
      const initialAdminUsername = process.env.INITIAL_ADMIN_USERNAME || 'admin';
      const passwordError = validatePassword(initialAdminPassword);

      if (passwordError) {
        throw new Error(`INITIAL_ADMIN_PASSWORD inválida: ${passwordError}`);
      }

      const adminHash = await bcrypt.hash(initialAdminPassword, salt);

      // Seed Administrator
      await dbClient.query(`
        INSERT INTO users (name, email, username, password_hash, role) 
        VALUES ($1, $2, $3, $4, $5)
      `, ['Administrador', initialAdminEmail, initialAdminUsername, adminHash, 'ADMIN']);

      if (process.env.SEED_DEMO_USERS === 'true' || !isProduction) {
        const vendedorHash = await bcrypt.hash('Vendedor123', salt);
        await dbClient.query(`
          INSERT INTO users (name, email, username, password_hash, role)
          VALUES ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10)
        `, [
          'Juan Pérez', 'juan@tallervisitas.com', 'juan', vendedorHash, 'VENDEDOR',
          'María Andrade', 'maria@tallervisitas.com', 'maria', vendedorHash, 'VENDEDOR'
        ]);
      }

      console.log("Initial users seeded successfully. Change the initial password after first login.");
    } else {
      console.log("Tables already exist. Skipping schema setup and seeding.");
    }

    // Step 4: Ensure geofencing columns exist on visitas table
    console.log("Ensuring geofencing columns exist on visitas table...");
    await dbClient.query(`
      ALTER TABLE visitas 
      ADD COLUMN IF NOT EXISTS fuera_rango BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS distancia_metros DOUBLE PRECISION DEFAULT 0;
    `);
    console.log("Geofencing columns verified.");

    // Step 5: Ensure username column exists on users table and backfill defaults
    console.log("Ensuring username column exists on users table...");
    await dbClient.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;
    `);
    await dbClient.query(`UPDATE users SET username = 'admin' WHERE email = 'admin@tallervisitas.com' AND username IS NULL;`);
    await dbClient.query(`UPDATE users SET username = 'juan' WHERE email = 'juan@tallervisitas.com' AND username IS NULL;`);
    await dbClient.query(`UPDATE users SET username = 'maria' WHERE email = 'maria@tallervisitas.com' AND username IS NULL;`);
    console.log("Username column and seeded backfills verified.");

    // Step 6: Ensure is_active column exists on users table
    console.log("Ensuring is_active column exists on users table...");
    await dbClient.query(`
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
    `);
    console.log("is_active column verified.");

    // Step 7: Ensure workshop detailed info columns exist on talleres table
    console.log("Ensuring workshop detailed info columns exist on talleres table...");
    await dbClient.query(`
      ALTER TABLE talleres 
      ADD COLUMN IF NOT EXISTS propietario VARCHAR(255),
      ADD COLUMN IF NOT EXISTS telefono VARCHAR(50),
      ADD COLUMN IF NOT EXISTS direccion VARCHAR(255),
      ADD COLUMN IF NOT EXISTS correo VARCHAR(255),
      ADD COLUMN IF NOT EXISTS observaciones TEXT,
      ADD COLUMN IF NOT EXISTS sector VARCHAR(100),
      ADD COLUMN IF NOT EXISTS vendedor_asignado_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

      CREATE INDEX IF NOT EXISTS idx_talleres_sector ON talleres(sector);
      CREATE INDEX IF NOT EXISTS idx_talleres_vendedor_asignado ON talleres(vendedor_asignado_id);
    `);
    console.log("Workshop detailed info columns verified.");

    // Step 8: Ensure recoverable workshop deletion and audit logging exist
    console.log("Ensuring workshop lifecycle and audit tables exist...");
    await dbClient.query(`
      ALTER TABLE talleres
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

      CREATE TABLE IF NOT EXISTS activity_logs (
        id BIGSERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(100),
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        ip_address VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_talleres_is_active ON talleres(is_active);
    `);
    console.log("Workshop lifecycle and audit tables verified.");

    // Step 9: Ensure visit observations and weekly scheduling exist
    console.log("Ensuring visit scheduling tables and columns exist...");
    await dbClient.query(`
      ALTER TABLE visitas
      ADD COLUMN IF NOT EXISTS observacion TEXT,
      ADD COLUMN IF NOT EXISTS programacion_id INTEGER;
    `);

    await dbClient.query(`
      CREATE TABLE IF NOT EXISTS programaciones_visita (
        id SERIAL PRIMARY KEY,
        taller_id INTEGER NOT NULL REFERENCES talleres(id) ON DELETE CASCADE,
        vendedor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        fecha_programada DATE NOT NULL,
        hora_programada TIME NOT NULL DEFAULT '08:00',
        duracion_minutos INTEGER NOT NULL DEFAULT 30 CHECK (duracion_minutos BETWEEN 1 AND 30),
        observacion TEXT,
        estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'EJECUTADA', 'CANCELADA')),
        visita_id INTEGER REFERENCES visitas(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (taller_id, vendedor_id, fecha_programada, hora_programada)
      );
    `);

    await dbClient.query(`
      ALTER TABLE programaciones_visita
      ADD COLUMN IF NOT EXISTS hora_programada TIME NOT NULL DEFAULT '08:00',
      ADD COLUMN IF NOT EXISTS duracion_minutos INTEGER NOT NULL DEFAULT 30;

      ALTER TABLE programaciones_visita
      DROP CONSTRAINT IF EXISTS programaciones_visita_taller_id_vendedor_id_fecha_programada_key,
      DROP CONSTRAINT IF EXISTS programaciones_visita_slot_key,
      DROP CONSTRAINT IF EXISTS programaciones_visita_duracion_check;

      ALTER TABLE programaciones_visita
      ADD CONSTRAINT programaciones_visita_slot_key
        UNIQUE (taller_id, vendedor_id, fecha_programada, hora_programada),
      ADD CONSTRAINT programaciones_visita_duracion_check
        CHECK (duracion_minutos BETWEEN 1 AND 30);
    `);

    await dbClient.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE constraint_name = 'visitas_programacion_id_fkey'
            AND table_name = 'visitas'
        ) THEN
          ALTER TABLE visitas
          ADD CONSTRAINT visitas_programacion_id_fkey
          FOREIGN KEY (programacion_id) REFERENCES programaciones_visita(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);
    console.log("Visit scheduling verified.");

    // Step 10: Enable messenger roles, delivery points and automatic route timing.
    console.log("Ensuring messenger delivery tracking exists...");
    await dbClient.query(`
      ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
      ALTER TABLE users ADD CONSTRAINT users_role_check
        CHECK (role IN ('ADMIN', 'VENDEDOR', 'MENSAJERO'));

      ALTER TABLE talleres
      ADD COLUMN IF NOT EXISTS tipo VARCHAR(20) NOT NULL DEFAULT 'TALLER',
      ADD COLUMN IF NOT EXISTS radio_geocerca_metros INTEGER NOT NULL DEFAULT 100;

      ALTER TABLE talleres DROP CONSTRAINT IF EXISTS talleres_tipo_check;
      ALTER TABLE talleres ADD CONSTRAINT talleres_tipo_check
        CHECK (tipo IN ('TALLER', 'MATRIZ', 'LOCAL', 'ALMACEN'));
      ALTER TABLE talleres DROP CONSTRAINT IF EXISTS talleres_radio_geocerca_metros_check;
      ALTER TABLE talleres ADD CONSTRAINT talleres_radio_geocerca_metros_check
        CHECK (radio_geocerca_metros BETWEEN 20 AND 1000);

      CREATE TABLE IF NOT EXISTS messenger_tracking_state (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        inside_point_id INTEGER REFERENCES talleres(id) ON DELETE SET NULL,
        last_latitud DOUBLE PRECISION,
        last_longitud DOUBLE PRECISION,
        last_accuracy_metros DOUBLE PRECISION,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS entregas_recorridos (
        id BIGSERIAL PRIMARY KEY,
        mensajero_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        origen_id INTEGER NOT NULL REFERENCES talleres(id) ON DELETE RESTRICT,
        destino_id INTEGER REFERENCES talleres(id) ON DELETE RESTRICT,
        estado VARCHAR(20) NOT NULL DEFAULT 'EN_RUTA'
          CHECK (estado IN ('EN_RUTA', 'ENTREGADA', 'CANCELADA')),
        salida_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        llegada_at TIMESTAMP,
        salida_latitud DOUBLE PRECISION NOT NULL,
        salida_longitud DOUBLE PRECISION NOT NULL,
        llegada_latitud DOUBLE PRECISION,
        llegada_longitud DOUBLE PRECISION,
        distancia_destino_metros DOUBLE PRECISION,
        precision_llegada_metros DOUBLE PRECISION,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_entregas_un_recorrido_activo
        ON entregas_recorridos(mensajero_id) WHERE estado = 'EN_RUTA';
      CREATE INDEX IF NOT EXISTS idx_entregas_salida_at ON entregas_recorridos(salida_at DESC);
    `);
    console.log("Messenger delivery tracking verified.");
  } catch (error) {
    console.error("Error setting up database tables:", error);
    throw error;
  } finally {
    if (shouldConnect) {
      await dbClient.end();
    }
  }
}

module.exports = {
  pool,
  initDatabase,
  query: (text, params) => pool.query(text, params)
};
