-- SQL Schema for TallerVisitas Pro

-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'VENDEDOR', 'MENSAJERO')),
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
  tipo VARCHAR(20) NOT NULL DEFAULT 'TALLER' CHECK (tipo IN ('TALLER', 'MATRIZ', 'LOCAL', 'ALMACEN')),
  radio_geocerca_metros INTEGER NOT NULL DEFAULT 100 CHECK (radio_geocerca_metros BETWEEN 20 AND 1000),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMP,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE activity_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(100),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(100),
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

-- Automatic messenger route tracking. A route starts after leaving a known
-- origin geofence and finishes when the messenger confirms inside a destination.
CREATE TABLE messenger_tracking_state (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  inside_point_id INTEGER REFERENCES talleres(id) ON DELETE SET NULL,
  last_latitud DOUBLE PRECISION,
  last_longitud DOUBLE PRECISION,
  last_accuracy_metros DOUBLE PRECISION,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE entregas_recorridos (
  id BIGSERIAL PRIMARY KEY,
  mensajero_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  origen_id INTEGER NOT NULL REFERENCES talleres(id) ON DELETE RESTRICT,
  destino_id INTEGER REFERENCES talleres(id) ON DELETE RESTRICT,
  estado VARCHAR(20) NOT NULL DEFAULT 'EN_RUTA' CHECK (estado IN ('EN_RUTA', 'ENTREGADA', 'CANCELADA')),
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

CREATE UNIQUE INDEX idx_entregas_un_recorrido_activo
  ON entregas_recorridos(mensajero_id) WHERE estado = 'EN_RUTA';
