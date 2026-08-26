const db = require('../db');

/**
 * Get workshops and company points with their latest visit information for the map.
 */
const getPuntosMapa = async (req, res) => {
  try {
    const queryText = `
      WITH latest_visitas AS (
        SELECT DISTINCT ON (taller_id)
          taller_id,
          foto_url,
          fecha_visita,
          vendedor_id
        FROM visitas
        ORDER BY taller_id, fecha_visita DESC
      )
      SELECT 
        t.id,
        t.nombre,
        t.latitud,
        t.longitud,
        t.created_at,
        COALESCE(s.nombre, t.sector) AS sector,
        t.sector_id,
        s.color AS sector_color,
        t.vendedor_asignado_id,
        assigned_user.name AS vendedor_asignado_nombre,
        t.tipo,
        t.radio_geocerca_metros,
        lv.foto_url,
        lv.fecha_visita,
        u.name as vendedor_nombre
      FROM talleres t
      LEFT JOIN latest_visitas lv ON t.id = lv.taller_id
      LEFT JOIN users u ON lv.vendedor_id = u.id
      LEFT JOIN users assigned_user ON assigned_user.id = t.vendedor_asignado_id
      LEFT JOIN sectores s ON s.id = t.sector_id
      WHERE t.is_active = TRUE
        AND (
          t.tipo IN ('MATRIZ', 'LOCAL', 'ALMACEN')
          OR (
            t.tipo = 'TALLER'
            AND ($1::text <> 'VENDEDOR' OR EXISTS (
              SELECT 1 FROM vendedor_sectores own
              JOIN sectores own_sector ON own_sector.id = own.sector_id AND own_sector.is_active = TRUE
              WHERE own.sector_id = t.sector_id AND own.vendedor_id = $2
            ))
          )
        )
      ORDER BY t.nombre ASC;
    `;

    const result = await db.query(queryText, [req.user.role, req.user.id]);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching map workshops data:', error);
    return res.status(500).json({ 
      error: 'Error al obtener los datos del mapa.' 
    });
  }
};

/**
 * Calculate a driving route using a fixed OSRM-compatible routing service.
 * Keeping this request server-side avoids browser CSP/CORS issues and prevents
 * clients from choosing an arbitrary upstream URL.
 */
const getRuta = async (req, res) => {
  const { origen, destino } = req.body || {};
  if ([origen, destino].some((point) => (
    !point || point.latitud === null || point.latitud === '' || point.longitud === null || point.longitud === ''
  ))) {
    return res.status(400).json({ error: 'Debe indicar las coordenadas de origen y destino.' });
  }
  const coordinates = [origen, destino].map((point) => ({
    latitud: Number(point?.latitud),
    longitud: Number(point?.longitud)
  }));

  if (coordinates.some(({ latitud, longitud }) => (
    !Number.isFinite(latitud) || !Number.isFinite(longitud)
    || latitud < -90 || latitud > 90 || longitud < -180 || longitud > 180
  ))) {
    return res.status(400).json({ error: 'Las coordenadas de origen o destino no son válidas.' });
  }

  const [{ latitud: originLat, longitud: originLng }, { latitud: destinationLat, longitud: destinationLng }] = coordinates;
  if (originLat === destinationLat && originLng === destinationLng) {
    return res.status(400).json({ error: 'Seleccione dos puntos diferentes para calcular la ruta.' });
  }

  const routingBaseUrl = (process.env.ROUTING_SERVICE_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
  const routeUrl = `${routingBaseUrl}/route/v1/driving/${originLng},${originLat};${destinationLng},${destinationLat}?overview=full&geometries=geojson&steps=false`;
  const abortController = new AbortController();
  const timeout = setTimeout(() => abortController.abort(), 12000);

  try {
    const response = await fetch(routeUrl, {
      signal: abortController.signal,
      headers: { 'User-Agent': 'TallerVisitas-Pro/1.1' }
    });
    const data = await response.json().catch(() => ({}));
    const route = data.routes?.[0];

    if (!response.ok || data.code !== 'Ok' || !route?.geometry?.coordinates?.length) {
      return res.status(502).json({ error: 'No se encontró una ruta transitable entre los puntos seleccionados.' });
    }

    return res.status(200).json({
      distancia_metros: Math.round(route.distance),
      duracion_segundos: Math.round(route.duration),
      geometria: route.geometry
    });
  } catch (error) {
    const message = error.name === 'AbortError'
      ? 'El servicio de rutas tardó demasiado en responder.'
      : 'El servicio de rutas no está disponible en este momento.';
    return res.status(503).json({ error: message });
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = {
  getPuntosMapa,
  getRuta
};
