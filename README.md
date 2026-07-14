# TallerVisitas Pro

Sistema web para registrar visitas geolocalizadas de vendedores a talleres mecanicos. Incluye autenticacion por roles, registro con foto y GPS, dashboards administrativos, gestion de talleres/vendedores y mapa con Leaflet.

## Stack

- Backend: Node.js, Express, PostgreSQL, JWT, bcryptjs, multer.
- Frontend: React, Vite, React Router, React Leaflet, Lucide React.
- Deploy recomendado: Railway Web Service + Railway PostgreSQL + Volume para fotos.

## Desarrollo local

### 1. Backend

```bash
cd backend
copy .env.example .env
npm install
npm run dev
```

Variables locales principales en `backend/.env`:

```env
PORT=5000
NODE_ENV=development
PGHOST=localhost
PGUSER=postgres
PGPASSWORD=admin
PGDATABASE=tallervisitas_db
PGPORT=5432
JWT_SECRET=replace-with-a-long-random-secret
```

El backend inicializa las tablas y usuarios demo si la tabla `users` no existe.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

El frontend corre en `http://localhost:3000` y en desarrollo apunta al backend usando el mismo host con puerto `5000`. Si usas otro puerto para el backend local, define `VITE_API_BASE_URL` en `frontend/.env`.

## Build local unificado

Desde la raiz:

```bash
npm run build
npm start
```

El backend sirve el build de React desde `frontend/dist`.

## Despliegue en Railway

Este repositorio incluye `railway.json` para que Railway use:

- Builder: `RAILPACK`
- Build Command: `npm run build`
- Start Command: `npm start`
- Health Check Path: `/health`

Pasos:

1. Sube el repositorio a GitHub.
2. En Railway, crea un proyecto desde el repo.
3. Agrega una base de datos PostgreSQL al proyecto.
4. En el servicio web, agrega una variable `DATABASE_URL` referenciando la base PostgreSQL.
5. Agrega estas variables en el servicio web:

```env
NODE_ENV=production
JWT_SECRET=un-secreto-largo-y-aleatorio
MAX_UPLOAD_MB=10
```

Railway inyecta `RAILWAY_PUBLIC_DOMAIN`; el backend lo usa para permitir CORS automaticamente en el dominio publico del servicio. Si luego configuras un dominio propio, agrega:

```env
CORS_ORIGIN=https://tu-dominio.com
```

### Fotos subidas en Railway

Railway no conserva archivos escritos dentro del contenedor entre despliegues si no usas almacenamiento persistente. Para conservar fotos:

1. Crea un Volume y conéctalo al servicio web.
2. Define `UPLOAD_DIR` usando el mount path del volumen:

```env
UPLOAD_DIR=${RAILWAY_VOLUME_MOUNT_PATH}/uploads
```

Si no agregas volumen, la app funciona, pero las fotos pueden perderse al redeploy/restart.

## Despliegue en Render

Este repositorio incluye `render.yaml` para crear:

- Un Web Service Node.
- Una base Render Postgres.
- Un Persistent Disk montado en `/var/data` para conservar fotos subidas.

Pasos:

1. Sube el repositorio a GitHub.
2. En Render, crea un Blueprint desde el repo.
3. Render usara:
   - Build Command: `npm run build`
   - Start Command: `npm start`
   - Health Check Path: `/health`
4. Cuando Render asigne el dominio final, actualiza `CORS_ORIGIN` con ese origen, por ejemplo:

```env
CORS_ORIGIN=https://tallervisitas-pro.onrender.com
```

`DATABASE_URL` y `JWT_SECRET` se configuran desde `render.yaml`. `UPLOAD_DIR=/var/data/uploads` guarda las imagenes en el disco persistente.

## Variables de produccion

| Variable | Uso |
| --- | --- |
| `NODE_ENV=production` | Activa validaciones de produccion. |
| `DATABASE_URL` | Conexion a Render Postgres. |
| `RAILWAY_PUBLIC_DOMAIN` | Dominio publico inyectado por Railway; se usa para CORS automatico. |
| `JWT_SECRET` | Secreto largo para firmar tokens. Obligatorio en produccion. |
| `CORS_ORIGIN` | Origen permitido para llamadas cross-origin. |
| `UPLOAD_DIR` | Ruta de almacenamiento de fotos. En Railway: `${RAILWAY_VOLUME_MOUNT_PATH}/uploads`; en Render: `/var/data/uploads`. |
| `MAX_UPLOAD_MB` | Limite de subida por foto. |

## Cuentas demo iniciales

| Rol | Usuario/correo | Contrasena |
| --- | --- | --- |
| ADMIN | `admin` / `admin@tallervisitas.com` | `admin123` |
| VENDEDOR | `juan` / `juan@tallervisitas.com` | `vendedor123` |
| VENDEDOR | `maria` / `maria@tallervisitas.com` | `vendedor123` |

Para produccion, cambia estas contrasenas apenas termine el primer despliegue.

## Pendientes recomendados

- Migrar fotos a almacenamiento de objetos como Cloudflare R2 o S3 si el volumen crece.
- Agregar migraciones versionadas en vez de `ALTER TABLE` dentro del arranque.
- Agregar rate limiting al login y politicas de contrasena mas fuertes.
- Evitar usuarios demo automaticos en entornos productivos definitivos.
- Agregar tests basicos de API y build en CI antes de desplegar.
