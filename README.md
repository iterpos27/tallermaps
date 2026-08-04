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

El backend inicializa las tablas automáticamente. En desarrollo crea un administrador local con contraseña `Admin12345` y usuarios demo. En producción no utiliza contraseñas conocidas: exige `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_USERNAME` e `INITIAL_ADMIN_PASSWORD` al crear una base nueva.

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
INITIAL_ADMIN_EMAIL=admin@tuempresa.com
INITIAL_ADMIN_USERNAME=admin
INITIAL_ADMIN_PASSWORD=una-clave-inicial-segura-2026
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
| `INITIAL_ADMIN_EMAIL` | Correo del primer administrador de una base nueva. |
| `INITIAL_ADMIN_USERNAME` | Usuario del primer administrador. |
| `INITIAL_ADMIN_PASSWORD` | Contraseña inicial de mínimo 10 caracteres con letras y números. |
| `SEED_DEMO_USERS` | Use `true` solo en entornos de demostración. |
| `CORS_ORIGIN` | Origen permitido para llamadas cross-origin. |
| `UPLOAD_DIR` | Ruta de almacenamiento de fotos. En Railway: `${RAILWAY_VOLUME_MOUNT_PATH}/uploads`; en Render: `/var/data/uploads`. |
| `MAX_UPLOAD_MB` | Limite de subida por foto. |

## Cuentas locales iniciales

| Rol | Usuario/correo | Contrasena |
| --- | --- | --- |
| ADMIN | `admin` / `admin@tallervisitas.com` | `Admin12345` |
| VENDEDOR | `juan` / `juan@tallervisitas.com` | `Vendedor123` |
| VENDEDOR | `maria` / `maria@tallervisitas.com` | `Vendedor123` |

Estas cuentas solo se crean automáticamente fuera de producción o cuando `SEED_DEMO_USERS=true`. Cambie la contraseña inicial del administrador después del primer ingreso.

## Calidad y verificación

```bash
npm run check
```

El comando ejecuta ESLint, pruebas unitarias del backend y el build del frontend. El flujo `.github/workflows/ci.yml` repite estas verificaciones en cada pull request.

## Respaldo de PostgreSQL

El respaldo requiere `pg_dump` instalado y accesible. Para crear un archivo en `backend/backups`:

```bash
npm run backup --prefix backend
```

Puede configurar `BACKUP_DIR` y `PG_DUMP_PATH`. En producción, programe este comando y copie los archivos a almacenamiento externo cifrado. Pruebe periódicamente la restauración con `pg_restore`; un respaldo no verificado no debe considerarse recuperable.

## Seguridad y auditoría

- El login limita intentos por dirección IP.
- Helmet agrega cabeceras de seguridad y los cuerpos JSON tienen límite.
- Las contraseñas nuevas requieren mínimo 10 caracteres con letras y números.
- Eliminar un taller realiza una baja lógica: desaparece del mapa y operación diaria, pero conserva visitas, fotos y programaciones.
- Los administradores pueden mostrar y restaurar talleres eliminados.
- La pantalla **Actividad** registra cambios de usuarios, contraseñas y talleres.
- Cada petición incluye `X-Request-Id`; `/health` comprueba también la conexión a PostgreSQL.

## Funcionamiento móvil y offline

- Las fotos se redimensionan y comprimen antes de subirlas.
- Las visitas sin conexión se guardan en IndexedDB, que admite fotos de mayor tamaño que `localStorage`.
- La cola registra reintentos y conserva los conflictos para revisión sin perder datos.
- El mapa agrupa talleres automáticamente según el nivel de zoom y permite buscarlos por nombre.

## Control de entregas por geocerca

- El administrador puede crear usuarios con rol `MENSAJERO` y configurar puntos internos como `MATRIZ`, `LOCAL` o `ALMACEN` con un radio entre 20 y 1000 metros. Los talleres los registra normalmente el vendedor y, como alternativa, el mensajero al confirmar una entrega en un destino nuevo.
- El mensajero debe abrir la web dentro de Matriz/local/almacén y mantenerla abierta mientras sale. El servidor inicia el recorrido al detectar la primera posición fuera de la geocerca.
- Al llegar, el mensajero abre la web y pulsa **Entrega realizada**. El backend selecciona el destino activo más cercano, valida su geocerca y calcula el tiempo entre salida y llegada.
- El administrador consulta los recorridos, tiempos y estados desde **Entregas**.
- `MAX_GPS_ACCURACY_METERS` permite cambiar la precisión máxima aceptada al confirmar una entrega; el valor predeterminado es 150 metros.

El navegador no registra ubicaciones cuando está cerrado. Para detectar la salida, la página debe seguir abierta al abandonar el punto de origen; una vez que el servidor confirma la salida, el recorrido permanece activo aunque luego se cierre la web.

## Próximas mejoras recomendadas

- Migrar fotos a almacenamiento de objetos como Cloudflare R2 o S3 si el volumen crece.
- Adoptar migraciones SQL versionadas en vez de ejecutar ajustes de esquema durante el arranque.
- Mover la autenticación a cookies `HttpOnly` cuando frontend y API tengan un dominio estable.
- Integrar un servicio externo de alertas y trazas si aumenta el volumen de usuarios.
- Añadir pruebas de integración contra una base PostgreSQL temporal.
