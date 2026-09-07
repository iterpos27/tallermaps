# Pruebas de campo — TallerVisitas Pro

Fecha de ejecución: __________ · Responsable: __________ · Versión/commit: __________

## Antes de salir

- Publicar la versión probada y comprobar que las migraciones 003 y 004 se aplicaron sin errores. Recargar las páginas abiertas.
- Revisar en Seguimiento el último respaldo y la última verificación. El servidor debe tener un volumen persistente para fotos y respaldos.
- Usar cuentas de prueba de administrador, dos vendedores con sectores distintos y un mensajero. No compartir cuentas.
- Registrar modelo del celular, sistema operativo, navegador, conexión y precisión GPS mostrada. Probar al menos un Android y un iPhone si se usarán ambos.

## Casos y resultado esperado

| Caso | Pasos | Resultado esperado | Resultado real / evidencia |
|---|---|---|---|
| Visita normal | Elegir taller, foto, observación y resultado Interesado | Una visita con vendedor, fecha y foto correctos | |
| Venta | Registrar resultado Venta realizada | Aumenta el indicador de ventas y aparece en Excel/PDF | |
| Seguimiento | Seleccionar Seguimiento sin fecha o compromiso | Bloquea el formulario | |
| Compromiso válido | Registrar fecha futura y descripción de al menos 10 caracteres | Un compromiso pendiente asociado a la visita y vendedor | |
| Privacidad | Entrar con el segundo vendedor | No puede listar ni cerrar compromisos del primero | |
| Cierre | Completar con nota de cierre; repetir el cierre | Se guarda la nota y se rechaza la repetición | |
| Histórico | Abrir Seguimiento → Ficha del taller | Datos, fotos, vendedores, resultados y compromisos visibles | |
| Geocerca | Intentar alta junto a un taller existente | Rechazo si la distancia calculada es 50 m o menos | |
| Límite de 50 m | Contrastar 49/50/51 m con ubicación de referencia | ≤50 m bloqueado; >50 m permitido si nombre y demás datos son válidos | |
| GPS denegado | Denegar ubicación y luego concederla desde ajustes del navegador | Mensaje claro y recuperación al actualizar GPS | |
| GPS variable | Repetir captura al aire libre y bajo techo | Registrar precisión y comparar ubicación; no confundir precisión con distancia | |
| Actualizar GPS fallido | Tener GPS, actualizar y provocar error | No reutiliza silenciosamente la ubicación anterior | |
| Foto | Probar cámara, imagen grande y archivo no válido | Imagen válida se procesa; error comprensible si falla | |
| Sin conexión | Con página abierta, activar modo avión y registrar visita con compromiso | Se conserva localmente, con foto y campos comerciales | |
| Cerrar y abrir | Cerrar navegador con visita pendiente; recuperar internet, entrar con la misma cuenta | La visita sigue pendiente o se sincroniza una sola vez | |
| Reintento | Cortar conexión después de enviar y luego sincronizar varias veces | No duplica visita, taller ni compromiso | |
| Cambio de cuenta | Guardar pendiente y entrar con otra cuenta | No sincroniza los registros de otro vendedor | |
| Conflicto offline | Otro vendedor crea primero un taller cercano | El pendiente queda para corrección, conservando datos y foto | |
| Reportes | Semana actual, semana que cruza año, rango de un día y vendedor | Fechas inclusivas; totales corresponden a las filas | |
| Exportar | Descargar CSV, Excel y PDF con más de 50 filas | Incluye todas las filas, acentos, observaciones y páginas necesarias | |
| Auditoría | Cambiar fecha de visita/datos de taller; cerrar compromiso | Actividad muestra autor, valores anteriores y nuevos | |
| Duplicados antiguos | Revisar un par cercano sin unificar | Conserva ambos talleres y guarda motivo de revisión | |
| Unificación | En datos de prueba, elegir ficha a conservar y motivo | Mueve historial y compromisos; archiva origen; conserva autores y fotos | |
| Conflicto de agenda | Unificar talleres con igual vendedor, fecha y hora programada | Rechaza operación sin cambios parciales | |
| Recuperación | Ejecutar backup y backup:verify en entorno de prueba | Restaura base temporal y fotos; conteos y hashes coinciden | |

## Criterios de aceptación

No debe perderse ni duplicarse una visita, mezclarse información entre cuentas ni quedar un respaldo marcado como correcto cuando faltan fotos. Los errores deben dejar información suficiente para corregir o reintentar.

Las pruebas automáticas usan coordenadas controladas. En campo, el GPS puede tener un error mayor que la distancia al límite; documentar la precisión y la ubicación de referencia. El sistema no obtiene ubicaciones con el navegador cerrado. Sin conexión, abrir por primera vez o recargar toda la aplicación puede requerir internet; no existe una aplicación instalable con caché completa.

## Registro de incidencias

| Hora | Usuario de prueba | Celular / navegador | Caso | Pasos exactos | Esperado | Obtenido | Captura / ID visita |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

Al terminar, conservar el reporte descargado y anotar cualquier pendiente sin sincronizar antes de cerrar sesión o limpiar datos del navegador.
