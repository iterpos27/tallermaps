# Seguridad

## Reporte de vulnerabilidades

Reporte vulnerabilidades de forma privada al propietario del repositorio. No publique credenciales, tokens, datos personales ni fotografías de visitas en issues públicos.

## Controles aplicados

- Cabeceras HTTP con Helmet y política CSP compatible con el mapa.
- Rate limiting en el inicio de sesión.
- JWT secreto obligatorio en producción.
- Credenciales iniciales suministradas por variables de entorno.
- Validación de contraseñas, correos y coordenadas.
- Auditoría de acciones administrativas y baja lógica de talleres.
- Límite para cuerpos JSON y fotografías.

## Nota sobre React Router

El proyecto usa React Router 7.18.2 en modo SPA (`BrowserRouter`). Al 30 de julio de 2026, `npm audit` reporta una vulnerabilidad de severidad alta en el modo experimental RSC/Server Actions para las versiones publicadas. TallerVisitas no utiliza RSC, acciones de servidor de React Router, SSR ni hidratación de React Router, por lo que esa ruta vulnerable no está expuesta. Debe actualizarse en cuanto exista una versión publicada corregida y compatible.

## Operación

- Rote `JWT_SECRET` y la contraseña administrativa ante cualquier sospecha de exposición.
- Mantenga PostgreSQL y los respaldos fuera de acceso público.
- Revise periódicamente la pantalla **Actividad** y los logs estructurados del servicio.
- Ejecute `npm audit` y `npm run check` antes de cada despliegue.
