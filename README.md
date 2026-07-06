# TallerVisitas Pro 🚗📍

Sistema web premium para el registro geolocalizado de visitas de vendedores a talleres mecánicos en Ecuador. 

El sistema permite a los vendedores registrar visitas capturando el nombre del taller, una foto desde la cámara de su celular y las coordenadas GPS de forma automática. El administrador puede visualizar todos los registros, filtrar datos por vendedor o fecha y ver cada taller marcado en un mapa interactivo (Leaflet).

---

## 🛠️ Tecnologías Utilizadas

### Backend
* **Node.js** + **Express**
* **PostgreSQL 17** (Driver `pg` nativo, sin Prisma)
* **JWT** (JSON Web Tokens) para autenticación de sesiones
* **Bcryptjs** para encriptación de contraseñas
* **Multer** para gestión y carga de imágenes en servidor local (con abstracción preparada para Cloudflare R2)

### Frontend
* **React** + **Vite**
* **React Leaflet** + **Leaflet** para visualización de mapas satelitales interactivos
* **Lucide React** para iconografía premium
* **Vanilla CSS** con variables de diseño personalizadas (glassmorphic, dark theme, animaciones y diseño móvil responsivo)

---

## 🔑 Cuentas Creadas por Defecto (Seeding Automático)

Al iniciar el backend por primera vez, el sistema creará automáticamente la base de datos y sembrará las siguientes credenciales para pruebas rápidas:

| Rol | Correo Electrónico | Contraseña | Funciones |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@tallervisitas.com` | `admin123` | Control total, mapa general, filtros de visitas, gestión de personal. |
| **VENDEDOR** | `juan@tallervisitas.com` | `vendedor123` | Registrar visitas (GPS + Cámara), ver historial personal. |
| **VENDEDOR** | `maria@tallervisitas.com` | `vendedor123` | Registrar visitas (GPS + Cámara), ver historial personal. |

---

## 🚀 Pasos de Instalación y Ejecución

### Requisitos Previos
* **Node.js** (versión v16 o superior)
* **PostgreSQL** instalado y ejecutándose en el puerto `5432`

---

### 1. Configuración de Base de Datos y Backend

1. Acceda a la carpeta del backend:
   ```bash
   cd backend
   ```
2. Instale las dependencias necesarias:
   ```bash
   npm install
   ```
3. Cree y verifique el archivo `.env` en la carpeta `backend/`. El sistema está configurado por defecto para conectarse a un PostgreSQL local con el usuario `postgres` y la contraseña `admin`:
   ```env
   PORT=5000
   PGHOST=localhost
   PGUSER=postgres
   PGPASSWORD=admin
   PGDATABASE=tallervisitas_db
   PGPORT=5432
   JWT_SECRET=tallervisitas_secret_key_2026_ecuador
   NODE_ENV=development
   ```
4. Inicie el servidor de desarrollo:
   ```bash
   npm run dev
   ```
   *El backend creará automáticamente la base de datos `tallervisitas_db` e inicializará las tablas (`users`, `talleres`, `visitas`) junto con los usuarios de prueba.*

---

### 2. Configuración y Ejecución del Frontend

1. Abra una nueva terminal y acceda a la carpeta del frontend:
   ```bash
   cd frontend
   ```
2. Instale las dependencias:
   ```bash
   npm install
   ```
3. Ejecute el servidor de desarrollo en modo red local:
   ```bash
   npm run dev
   ```
   *El frontend correrá en `http://localhost:3000`. Al correr en modo `--host`, Vite mostrará su IP local (por ejemplo `http://192.168.1.15:3000`). Utilice esa IP en su celular para probar el acceso a la cámara y el GPS en tiempo real.*

---

## 📱 Funcionamiento en Dispositivos Móviles

Para capturar correctamente la foto y las coordenadas GPS en tiempo real:
1. Conecte su celular a la misma red Wi-Fi de la computadora donde corre el proyecto.
2. Ingrese al navegador móvil usando la dirección IP local provista por Vite (ej: `http://192.168.x.x:3000`).
3. Inicie sesión como vendedor (`juan@tallervisitas.com` / `vendedor123`).
4. Vaya a **Registrar Visita**. Acepte el permiso de ubicación del navegador y presione el botón **Usar Cámara** o **Subir Archivo** para tomar la foto directamente.
