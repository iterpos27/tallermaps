-- SQL Schema for TallerVisitas Pro

-- Drop tables if they exist
DROP TABLE IF EXISTS visitas CASCADE;
DROP TABLE IF EXISTS talleres CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'VENDEDOR')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Talleres table
CREATE TABLE talleres (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) UNIQUE NOT NULL,
  latitud DECIMAL(10, 8) NOT NULL,
  longitud DECIMAL(11, 8) NOT NULL,
  propietario VARCHAR(255),
  telefono VARCHAR(50),
  direccion VARCHAR(255),
  correo VARCHAR(255),
  observaciones TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Visitas table
CREATE TABLE visitas (
  id SERIAL PRIMARY KEY,
  taller_id INTEGER REFERENCES talleres(id) ON DELETE CASCADE,
  vendedor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  foto_url VARCHAR(255) NOT NULL,
  latitud DECIMAL(10, 8) NOT NULL,
  longitud DECIMAL(11, 8) NOT NULL,
  fecha_visita TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
