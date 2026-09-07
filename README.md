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
PORT=5005
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

El frontend corre en `http://localhost:3000`. En desarrollo, Vite redirige `/api` y `/uploads` al backend en `http://localhost:5005`, evitando problemas de CORS y funcionando también desde dispositivos de la red local. Si usas otro puerto, define `VITE_API_PROXY_TARGET` en `frontend/.env`.

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

## Sectores comerciales

Los talleres se agrupan mediante sectores normalizados. Un vendedor puede tener uno o varios sectores y el backend limita automáticamente talleres, mapa, programaciones y nuevas visitas a esas asignaciones. Los administradores gestionan nombres, colores, estado y polígonos GeoJSON desde **Administración > Sectores** y asignan sectores desde **Personal**.

Para migrar instalaciones existentes y verificar la separación territorial:

```bash
npm run migrate:sectors --prefix backend
npm run verify:sectors --prefix backend
```

Los talleres antiguos sin clasificación se trasladan al sector transitorio **Por clasificar**, evitando pérdida de acceso durante la migración.

Los talleres nuevos registrados durante una visita quedan inicialmente **sin sector**. El vendedor no selecciona ni administra esta clasificación; un administrador asigna el sector posteriormente desde **Administración > Talleres**. Una vez clasificado, el taller solo aparece a los vendedores que tengan ese sector asignado.

## Funcionamiento móvil y offline

- Las fotos se redimensionan y comprimen antes de subirlas.
- Las visitas sin conexión se guardan en IndexedDB, que admite fotos de mayor tamaño que `localStorage`.
- La cola registra reintentos y conserva los conflictos para revisión sin perder datos.
- El mapa agrupa talleres automáticamente según el nivel de zoom y permite buscarlos por nombre.

### Validación de talleres y visitas

- No se permite crear un taller a **50 metros o menos** de otro taller registrado, incluso si pertenece a otro sector o está archivado. En este último caso se debe restaurar el registro original. Esta regla también se aplica al cambiar la ubicación de un taller y al registrar talleres desde visitas o entregas; no afecta a Matriz, locales o almacenes.
- El control de duplicados se realiza en el servidor y protege las solicitudes simultáneas. Los duplicados históricos no se eliminan automáticamente.
- El vendedor asignado puede acceder al taller sin sector hasta que el administrador lo clasifique. Después se aplican los permisos del sector.
- Las visitas se guardan en el dispositivo antes del envío, con propietario, identificador único y hora de captura. Un reintento no crea otra visita. La fecha comercial corresponde a Ecuador y la hora de captura también se conserva con zona horaria.
- La pantalla de pendientes permite corregir rechazos. Las visitas antiguas sin propietario se conservan sin sincronizar automáticamente para evitar atribuirlas a otra persona.
- Desactivar un usuario, cambiar su rol o restablecer su contraseña invalida sus sesiones anteriores. Se impide desactivar o cambiar de rol al último administrador activo.
- No se permite consumir otra vez una programación ejecutada ni reactivar una cancelada si su horario se cruza con otra visita.
- El mensajero puede cancelar un recorrido por incidencia, indicando un motivo que queda en el historial y en Actividad. El seguimiento y la confirmación exigen precisión GPS válida.

La migración `002_functional_validation` se aplica automáticamente al iniciar el backend. También puede ejecutarse con `npm run migrate --prefix backend`. Al actualizar, recargue las páginas abiertas para que envíen los nuevos identificadores de visitas.

Las pruebas integradas usan exclusivamente PostgreSQL local en una base de pruebas. Para ejecutarlas, configure `QA_PG_PORT` con el puerto de esa instancia y ejecute `npm run check`; crean y eliminan un esquema aislado. Sin esa variable se ejecutan las pruebas unitarias y de la cola offline, y la prueba integrada queda omitida.

## Reportes de talleres y visitas

Los administradores acceden a **Reportes** para consultar semanas de lunes a domingo o rangos de fechas inclusivos, con filtro por vendedor o creador. El CSV compatible con Excel incluye tipo de actividad, ID y nombre del taller, observaciones, fecha y hora de Ecuador y responsable. La vista muestra 50 filas por página; la descarga contiene todos los resultados.

Cada visita y alta tiene una fila independiente: un taller creado y visitado en el período aparece en ambas actividades. Las visitas usan su fecha de realización; las altas, su fecha de registro. Se incluyen talleres archivados. Las creaciones históricas sin autor verificable aparecen como **Sin registro**, sin atribuirlas al vendedor actualmente asignado. Las observaciones de altas corresponden a la ficha del taller.

La migración `003_reports` se aplica al iniciar el backend o con `npm run migrate --prefix backend`. Registra el creador de nuevas altas y recupera autores históricos disponibles en la auditoría. Las fechas históricas de creación se conservan tal como estaban almacenadas.

## Control de entregas por geocerca

- El administrador puede crear usuarios con rol `MENSAJERO` y configurar puntos internos como `MATRIZ`, `LOCAL` o `ALMACEN` con un radio entre 20 y 1000 metros. Los talleres los registra normalmente el vendedor y, como alternativa, el mensajero al confirmar una entrega en un destino nuevo.
- El mensajero debe abrir la web dentro de Matriz/local/almacén y mantenerla abierta mientras sale. El servidor inicia el recorrido al detectar la primera posición fuera de la geocerca.
- Al llegar, el mensajero abre la web y pulsa **Entrega realizada**. El backend selecciona el destino activo más cercano, valida su geocerca y calcula el tiempo entre salida y llegada.
- El administrador consulta los recorridos, tiempos y estados desde **Entregas**.
- `MAX_GPS_ACCURACY_METERS` permite cambiar la precisión máxima aceptada al confirmar una entrega; el valor predeterminado es 150 metros.

El navegador no registra ubicaciones cuando está cerrado. Para detectar la salida, la página debe seguir abierta al abandonar el punto de origen; una vez que el servidor confirma la salida, el recorrido permanece activo aunque luego se cierre la web.

## Seguimiento comercial y auditoría

**Nueva visita** incluye resultado comercial y, opcionalmente, próxima fecha y compromiso. El resultado Seguimiento exige ambos. Los registros de versiones anteriores siguen sincronizando como Sin registro cuando no incluyen resultado. La fecha del compromiso no puede ser anterior a la captura de la visita.

**Seguimiento** permite consultar pendientes/vencidos/cerrados, crear compromisos y cerrar con nota. Cada vendedor solo accede a sus compromisos; el administrador accede a todos. La ficha muestra contactos, fotos, visitas, resultados y compromisos. La fecha del compromiso es un recordatorio comercial, no reserva una franja en la agenda: las visitas con horario se crean desde Programación.

**Reportes** añade indicadores por vendedor, Excel con resumen y PDF paginado, además de CSV. El cumplimiento es programaciones ejecutadas / programaciones no canceladas del período. Ventas cuenta visitas marcadas Venta realizada; no representa facturación ni monto vendido. Las bibliotecas de exportación se cargan cuando se utilizan.

**Actividad** conserva instantáneas anteriores/nuevas al modificar o eliminar talleres, visitas y compromisos. Los cambios directos en la base sin contexto de usuario quedan con autor Sistema. La migración `004_commercial` es automática al iniciar; también se puede ejecutar `npm run migrate --prefix backend`.

### Duplicados antiguos

En Seguimiento → Revisar duplicados se muestran pares activos a 50 m o menos. Guardar revisión no modifica las fichas. Unificar historial requiere elegir el taller a conservar y un motivo: mueve visitas, programaciones y compromisos; mantiene responsables y fotografías, y archiva la ficha de origen. Conserva los datos, sector y ubicación del destino. El origen no se puede restaurar directamente después de unificar. Los recorridos de mensajería conservan sus puntos históricos. Un cruce exacto de vendedor/fecha/hora en programación bloquea la unificación sin cambios parciales.

## Respaldo automático y recuperación

El backend comprueba cada hora si corresponde un respaldo, con intervalo predeterminado de 24 horas; la primera comprobación ocurre 30 segundos después de iniciar. Incluye una instantánea PostgreSQL y la carpeta de fotos, manifiesto SHA-256 y conteos de seis tablas. Durante la captura se bloquean brevemente escrituras a talleres/visitas para mantener las referencias de fotos consistentes. La conexión a PostgreSQL tiene límite de 10 segundos y la herramienta de respaldo de 120 segundos; un error no actualiza el último respaldo correcto.

- `BACKUP_ENABLED=false`: desactiva la ejecución automática.
- `BACKUP_INTERVAL_HOURS`: intervalo, mínimo 1 hora; predeterminado 24.
- `BACKUP_DIR`: carpeta de respaldos. Por defecto es `backups` junto a la carpeta `uploads`. En producción ambas deben estar en almacenamiento persistente.
- `PG_DUMP_PATH` y `PG_RESTORE_PATH`: rutas opcionales a las herramientas PostgreSQL. El Dockerfile instala el cliente 18 desde el [repositorio oficial de PostgreSQL](https://www.postgresql.org/download/linux/debian/). En instalaciones sin Docker se necesitan herramientas compatibles con la versión del servidor.
- `npm run backup --prefix backend`: respaldo manual.
- `npm run backup:verify --prefix backend`: restaura el último respaldo en una base temporal `restore_qa_*`, copia/verifica las fotos y contrasta conteos. Elimina únicamente esa base y carpeta temporales. La cuenta de base necesita permiso de crear bases para esta prueba; no sobrescribe la base original.

El administrador puede ver el estado en Seguimiento → Estado de respaldos. La verificación se ejecuta expresamente con el comando anterior; no corre en cada respaldo. No se eliminan respaldos antiguos automáticamente. Conviene copiar los respaldos fuera del servidor: una copia en el mismo disco no protege frente a la pérdida completa del servidor.

Para mañana, seguir [PRUEBAS_CAMPO.md](PRUEBAS_CAMPO.md). Las pruebas de GPS real, permisos de cámara y comportamiento al cerrar el navegador deben ejecutarse en los teléfonos usados por el equipo.

## Próximas mejoras recomendadas

- Migrar fotos a almacenamiento de objetos como Cloudflare R2 o S3 si el volumen crece.
- Integrar un servicio externo de alertas y trazas si aumenta el volumen de usuarios.
