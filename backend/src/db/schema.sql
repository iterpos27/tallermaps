-- SQL Schema for TallerVisitas Pro

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
  programacion_id INTEGER,
  foto_url VARCHAR(255) NOT NULL,
  latitud DECIMAL(10, 8) NOT NULL,
  longitud DECIMAL(11, 8) NOT NULL,
  observacion TEXT,
  fecha_visita TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Weekly visit scheduling table
CREATE TABLE programaciones_visita (
  id SERIAL PRIMARY KEY,
  taller_id INTEGER NOT NULL REFERENCES talleres(id) ON DELETE CASCADE,
  vendedor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fecha_programada DATE NOT NULL,
  observacion TEXT,
  estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'EJECUTADA', 'CANCELADA')),
  visita_id INTEGER REFERENCES visitas(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (taller_id, vendedor_id, fecha_programada)
);
