const { Pool, Client } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Configuration for default postgres db connection (to create the main db if missing)
const dbConfig = {
  host: process.env.PGHOST || 'localhost',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'admin',
  port: parseInt(process.env.PGPORT || '5432'),
};

const mainDbName = process.env.PGDATABASE || 'tallervisitas_db';

// Create pool connected to the target database
const pool = new Pool({
  ...dbConfig,
  database: mainDbName
});

/**
 * Initializes the database, tables and seeds initial users if they do not exist
 */
async function initDatabase() {
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

  try {
    await dbClient.connect();

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

      // Step 3: Seed initial users
      console.log("Seeding initial users...");
      const salt = await bcrypt.genSalt(10);
      
      const adminHash = await bcrypt.hash('admin123', salt);
      const vendedorHash = await bcrypt.hash('vendedor123', salt);

      // Seed Administrator
      await dbClient.query(`
        INSERT INTO users (name, email, username, password_hash, role) 
        VALUES ($1, $2, $3, $4, $5)
      `, ['Administrador', 'admin@tallervisitas.com', 'admin', adminHash, 'ADMIN']);

      // Seed Vendor 1 (Juan)
      await dbClient.query(`
        INSERT INTO users (name, email, username, password_hash, role) 
        VALUES ($1, $2, $3, $4, $5)
      `, ['Juan Pérez', 'juan@tallervisitas.com', 'juan', vendedorHash, 'VENDEDOR']);

      // Seed Vendor 2 (María)
      await dbClient.query(`
        INSERT INTO users (name, email, username, password_hash, role) 
        VALUES ($1, $2, $3, $4, $5)
      `, ['María Andrade', 'maria@tallervisitas.com', 'maria', vendedorHash, 'VENDEDOR']);

      console.log("Initial users seeded successfully.");
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
      ADD COLUMN IF NOT EXISTS observaciones TEXT;
    `);
    console.log("Workshop detailed info columns verified.");
  } catch (error) {
    console.error("Error setting up database tables:", error);
    throw error;
  } finally {
    await dbClient.end();
  }
}

module.exports = {
  pool,
  initDatabase,
  query: (text, params) => pool.query(text, params)
};
