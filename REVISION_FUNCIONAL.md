# Revisión funcional y de validaciones

## Correcciones implementadas

Actualización posterior a la autorización del usuario:

- Geocerca contra duplicados de **50 metros inclusive**, aplicada en altas por mapa/API, visitas y mensajeros, y en cambios de ubicación. Incluye talleres archivados y de otros sectores. Las solicitudes simultáneas se serializan; no se modificaron duplicados históricos.
- Permisos explícitos para visitas y agenda; consulta del estado vigente del usuario en cada petición, revocación de sesiones y protección del último administrador activo.
- Visitas guardadas antes del envío, cola separada por usuario, reintentos idempotentes, fecha de captura con zona horaria y fecha comercial ecuatoriana.
- Guardado transaccional de taller, visita y programación; rechazo de programaciones ya finalizadas; conflictos de agenda comprobados también al reactivar y ante concurrencia.
- Validación estricta de coordenadas, tipos de campos, fechas, identificadores y rangos de consulta. La precisión GPS es obligatoria para entregas y seguimiento.
- Corrección de pendientes rechazados desde la interfaz, sin cambiar su fotografía, GPS u hora de captura. Los registros antiguos sin propietario quedan conservados y advertidos, sin atribuirlos automáticamente a otra cuenta.
- Acceso del vendedor asignado a talleres aún sin sector, hasta su clasificación administrativa.
- Cancelación de recorridos con motivo e historial.

**Verificación:** ESLint, compilación y 35 pruebas con PostgreSQL local aislado, incluyendo concurrencia, rollback por fallo de finalización, permisos, revocación, cola offline y límites de 49/50/51 metros. La interfaz de administración permitió ingresar y crear un taller ficticio; un segundo formulario en un punto ya registrado mostró el rechazo de 50 metros. La consulta de errores de consola de esa sesión no reportó errores.

**Aplicación:** la migración `002_functional_validation` se ejecuta al iniciar el backend. Recargar las páginas abiertas al actualizar. No se desplegó ni se operó sobre la base real. Se conservan las opciones existentes de editar fecha/hora y eliminar visitas propias; no se impusieron nuevas reglas de aprobación ni se bloquean visitas fuera de rango, que continúan marcándose. La prueba en un teléfono con GPS real y pérdida de conectividad sigue siendo una comprobación de campo pendiente.

Los puntos siguientes conservan el diagnóstico original como referencia; deben leerse junto al estado actualizado anterior.

Revisión del código local, 6 de septiembre de 2026. No se modificó la lógica del sistema ni se realizaron operaciones sobre datos de producción. ESLint, las 11 pruebas del backend y la compilación del frontend pasan. Se ejecutó además el validador GPS directamente: acepta `''`, espacios, `null` y `false` como coordenadas válidas. Los demás hallazgos se obtienen del recorrido del código; quedan pendientes pruebas integradas con navegador, GPS real y una base de prueba.

## Prioridad alta

1. **Permisos incompletos para mensajeros.** `backend/src/routes/visitaRoutes.js` permite consultar y crear visitas a cualquier usuario autenticado. Los controladores solo restringen las consultas cuando el rol es VENDEDOR, por lo que MENSAJERO puede consultar visitas ajenas. `programacionRoutes.js` tampoco restringe roles y `updateProgramacion` solo comprueba propiedad y transiciones para VENDEDOR: un mensajero puede modificar programaciones ajenas mediante API. Corregir con permisos explícitos en rutas y controladores. Verificar cada operación con los tres roles, incluyendo solicitudes directas.

2. **Desactivación y cambio de rol no se aplican a sesiones existentes.** `middlewares/auth.js` usa el rol firmado en el JWT sin consultar el estado actual del usuario. `authController.js` emite tokens de 24 horas; la comprobación de usuario activo en `/auth/session` no protege todas las demás rutas. Cambiar contraseña tampoco revoca tokens. Verificar desactivación, cambio ADMIN a VENDEDOR y cambio de contraseña con una sesión previamente abierta. Consultar el estado vigente y añadir revocación/versionado de sesiones.

3. **Visitas offline sin propietario.** `RegistrarVisita.jsx` no guarda el usuario en la visita pendiente; `storage/offlineVisits.js` comparte una sola cola y `api/api.js` sincroniza todo con la sesión actual. Si A guarda una visita y B inicia sesión en el mismo navegador, la visita puede atribuirse a B si tiene acceso al taller, o quedar rechazada. Separar la cola por usuario y verificar su propietario al sincronizar.

4. **La sincronización puede duplicar visitas y cambia su fecha real.** La petición no incluye un identificador único de operación ni la fecha de captura. Si el servidor guarda pero se pierde la respuesta, el reintento vuelve a insertar. La fecha registrada es la del servidor al sincronizar, no la de la visita offline. Añadir idempotencia y distinguir fecha de captura de fecha de recepción, con validación de antigüedad y zona horaria.

5. **Una programación ejecutada puede volver a ejecutarse.** `visitaController.createVisita` rechaza CANCELADA, pero acepta EJECUTADA y sobrescribe `visita_id` al registrar otra visita. Además, crear taller, insertar visita y finalizar programación no comparten una transacción: un fallo intermedio puede dejar registros parciales; si falla la finalización después de insertar la visita, el catch elimina su fotografía. Usar transacción, bloqueo y transición explícita desde estados permitidos. Probar reenvío, concurrencia y fallo intermedio.

6. **Coordenadas vacías aceptadas.** `utils/validation.js` convierte primero con `Number`, por lo que valores vacíos, nulos o booleanos pasan como cero. Reproducción directa confirmada. Rechazar estos tipos antes de convertir, conservando el cero numérico como coordenada válida. En entregas, `parsePosition` convierte también antes de validar y la precisión puede omitirse; el control de precisión en la confirmación solo se aplica si está presente.

7. **Es posible dejar el sistema sin administradores activos.** `userController.updateUser` no impide desactivar al último administrador o cambiar su rol; la interfaz permite esas operaciones. Exigir al menos un administrador activo, también ante operaciones simultáneas.

## Prioridad media

8. **Sesión vencida no activa el cierre automático esperado.** El middleware devuelve 403 para token vencido, mientras `api/api.js` solo limpia y redirige con 401. Un usuario puede quedar en pantalla recibiendo errores. Unificar 401 para credenciales vencidas y 403 para falta de permisos.

9. **Fecha inválida al editar programación puede ignorarse.** `updateProgramacion` no devuelve error cuando se proporciona una fecha que `normalizeDate` convierte en null; `COALESCE` mantiene la anterior y la operación puede responder éxito. Además, el normalizador no compara componentes del calendario. Rechazar fechas imposibles y entradas inválidas explícitamente.

10. **Reactivar una programación cancelada evita la comprobación de cruces.** La validación de conflictos solo se ejecuta cuando cambian fecha, hora o duración. Caso: cancelar A, crear B en el mismo horario y devolver A a PENDIENTE cambiando únicamente estado. Verificar también conflictos en transiciones de estado y asegurar la comprobación frente a concurrencia.

11. **Geocerca de visitas depende de cómo se identifica el taller.** Si se envía un nombre que coincide con un taller existente, se resuelve su ID, pero la distancia solo se calcula cuando llegó `taller_id` en la petición. Calcular siempre contra el taller resuelto cuando este ya existía.

12. **Conflictos offline no tienen opción de corrección.** `VisitasOffline.jsx` permite reintentar o descartar, pero no corregir taller, observaciones o programación. Un 403 tampoco cuenta como conflicto: detiene el procesamiento de la cola en esa ejecución. Añadir revisión editable y clasificar errores permanentes sin impedir sincronizar registros independientes.

## Opciones que necesitan definición funcional

- **Cambiar fecha/hora y eliminar visitas:** actualmente el vendedor puede hacerlo sobre sus propias visitas. Definir si requiere límite temporal, motivo o aprobación; la fecha acepta cualquier fecha de calendario válida, incluso futura. No eliminar estas opciones sin confirmar la regla operativa.
- **Taller nuevo pendiente de clasificación:** la primera visita crea un taller sin sector, pero el acceso posterior exige sector activo asignado. Definir si el creador puede volver a visitarlo antes de la clasificación y mostrar claramente su estado.
- **Entregas interrumpidas:** no se encontró una operación de cancelación o cierre por incidencia en la API de entregas. Definir cómo resolver salida accidental, devolución al origen o entrega fallida, con motivo e historial.
- **Visita fuera de rango:** actualmente se permite guardarla y se marca a más de 100 metros. Definir si basta advertir, si exige justificación o si debe impedirse; contemplar precisión GPS.
- **Fecha comercial:** la asociación automática de visitas usa el día UTC (`toISOString`), que cambia a las 19:00 en Ecuador. Definir America/Guayaquil como referencia operativa si corresponde y aplicarla de forma uniforme.

## Verificación pendiente

Las pruebas actuales cubren utilidades y un registro de taller nuevo con dependencias simuladas; no acreditan el flujo completo. Añadir pruebas de permisos por rol, revocación, cambio de usuario con cola offline, pérdida de respuesta, transacciones, concurrencia, reactivación con cruces y GPS inválido. Completar una ronda funcional en móvil con GPS denegado, precisión deficiente y pérdida/recuperación de conexión.

Orden recomendado: permisos y sesiones; propietario/idempotencia offline; integridad de visita-programación; validadores y conflictos; ajustes de opciones según las reglas operativas.
## Preparación comercial para pruebas de campo (2026-09-06)

Implementados resultados comerciales, compromisos y cierres, ficha unificada, indicadores, CSV/Excel/PDF, auditoría antes/después y revisión/unificación manual de duplicados. Respaldos automáticos con base y fotos, manifiesto de integridad y comando de restauración temporal.

Validación: 44 pruebas aprobadas con PostgreSQL 17 aislado; lint y build correctos. Pruebas de exportación reabren Excel y verifican todas las filas y valores literales; PDF de 90 filas conserva el último registro y genera varias páginas. Recuperación comprobada en base temporal: seis tablas con conteos coincidentes y dos archivos íntegros (dump y fotografía). La verificación también copia y comprueba la foto restaurada.

Interfaz local: login con administrador ficticio autorizado, reporte semanal con indicadores, ficha de taller con visita/foto/compromiso, cierre de compromiso y consulta del estado COMPLETADO, detección de par histórico a 11,1 m y registro de auditoría visibles. Las acciones de descarga se ejecutaron sin errores de aplicación; el evento de descarga del navegador integrado no pudo confirmarse, por lo que los formatos se comprobaron adicionalmente desde el generador real.

Pendiente externo: pruebas físicas de GPS/cámara/conectividad según PRUEBAS_CAMPO.md. No se construyó la imagen Docker porque su motor no está en ejecución. No se publicó esta versión ni se aplicaron migraciones a la base real. El build advierte sobre el tamaño de ExcelJS, que se carga únicamente al exportar.
