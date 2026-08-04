const db = require('../db');
const { isValidLatitude, isValidLongitude } = require('../utils/validation');
const { logActivity } = require('../services/audit');

const ORIGIN_TYPES = new Set(['MATRIZ', 'LOCAL', 'ALMACEN']);
const MAX_GPS_ACCURACY_METERS = Number(process.env.MAX_GPS_ACCURACY_METERS || 150);

function distanceInMeters(lat1, lon1, lat2, lon2) {
  const earthRadius = 6371e3;
  const phi1 = Number(lat1) * Math.PI / 180;
  const phi2 = Number(lat2) * Math.PI / 180;
  const deltaPhi = (Number(lat2) - Number(lat1)) * Math.PI / 180;
  const deltaLambda = (Number(lon2) - Number(lon1)) * Math.PI / 180;
  const a = Math.sin(deltaPhi / 2) ** 2
    + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parsePosition(body) {
  const latitud = Number(body.latitud);
  const longitud = Number(body.longitud);
  const accuracy = body.accuracy == null ? null : Number(body.accuracy);

  if (!isValidLatitude(latitud) || !isValidLongitude(longitud)) return null;
  if (accuracy !== null && (!Number.isFinite(accuracy) || accuracy < 0)) return null;
  return { latitud, longitud, accuracy };
}

async function getActivePoints(client) {
  const result = await client.query(
    `SELECT id, nombre, tipo, latitud, longitud, radio_geocerca_metros
     FROM talleres
     WHERE is_active = TRUE AND latitud IS NOT NULL AND longitud IS NOT NULL`
  );
  return result.rows;
}

function nearestPointWithinGeofence(points, position, predicate = () => true) {
  return points
    .filter(predicate)
    .map((point) => ({
      ...point,
      distance: distanceInMeters(position.latitud, position.longitud, point.latitud, point.longitud)
    }))
    .filter((point) => point.distance <= Number(point.radio_geocerca_metros))
    .sort((a, b) => a.distance - b.distance)[0] || null;
}

const registerPosition = async (req, res) => {
  const position = parsePosition(req.body);
  if (!position) return res.status(400).json({ error: 'La posicion GPS no es valida.' });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const points = await getActivePoints(client);
    const origin = nearestPointWithinGeofence(
      points,
      position,
      (point) => ORIGIN_TYPES.has(point.tipo)
    );

    const stateResult = await client.query(
      'SELECT * FROM messenger_tracking_state WHERE user_id = $1 FOR UPDATE',
      [req.user.id]
    );
    const state = stateResult.rows[0] || null;
    const activeResult = await client.query(
      `SELECT r.id, r.origen_id, r.salida_at, t.nombre AS origen_nombre
       FROM entregas_recorridos r
       JOIN talleres t ON t.id = r.origen_id
       WHERE r.mensajero_id = $1 AND r.estado = 'EN_RUTA'
       FOR UPDATE OF r`,
      [req.user.id]
    );
    let active = activeResult.rows[0] || null;
    let event = 'POSITION_UPDATED';

    if (!active && !origin && state?.inside_point_id) {
      const previousOrigin = points.find((point) => Number(point.id) === Number(state.inside_point_id));
      if (previousOrigin && ORIGIN_TYPES.has(previousOrigin.tipo)) {
        const created = await client.query(
          `INSERT INTO entregas_recorridos
             (mensajero_id, origen_id, salida_latitud, salida_longitud)
           VALUES ($1, $2, $3, $4)
           RETURNING id, origen_id, salida_at`,
          [req.user.id, previousOrigin.id, position.latitud, position.longitud]
        );
        active = {
          ...created.rows[0],
          origen_nombre: previousOrigin.nombre
        };
        event = 'ROUTE_STARTED';
      }
    }

    await client.query(
      `INSERT INTO messenger_tracking_state
         (user_id, inside_point_id, last_latitud, last_longitud, last_accuracy_metros, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         inside_point_id = EXCLUDED.inside_point_id,
         last_latitud = EXCLUDED.last_latitud,
         last_longitud = EXCLUDED.last_longitud,
         last_accuracy_metros = EXCLUDED.last_accuracy_metros,
         updated_at = CURRENT_TIMESTAMP`,
      [req.user.id, active ? null : (origin?.id || null), position.latitud, position.longitud, position.accuracy]
    );

    await client.query('COMMIT');
    return res.status(200).json({
      event,
      insidePoint: origin ? { id: origin.id, nombre: origin.nombre, tipo: origin.tipo } : null,
      activeRoute: active
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error registering messenger position:', error);
    return res.status(500).json({ error: 'No se pudo actualizar el seguimiento del recorrido.' });
  } finally {
    client.release();
  }
};

const completeDelivery = async (req, res) => {
  const position = parsePosition(req.body);
  if (!position) return res.status(400).json({ error: 'La posicion GPS no es valida.' });
  if (position.accuracy !== null && position.accuracy > MAX_GPS_ACCURACY_METERS) {
    return res.status(400).json({
      error: `La precision del GPS es insuficiente (${Math.round(position.accuracy)} m). Espere una mejor senal e intente nuevamente.`
    });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const activeResult = await client.query(
      `SELECT r.id, r.origen_id, r.salida_at, o.nombre AS origen_nombre
       FROM entregas_recorridos r
       JOIN talleres o ON o.id = r.origen_id
       WHERE r.mensajero_id = $1 AND r.estado = 'EN_RUTA'
       FOR UPDATE OF r`,
      [req.user.id]
    );
    if (activeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'No existe un recorrido activo. Abra la web dentro de Matriz o local y mantengala abierta hasta detectar la salida.'
      });
    }

    const active = activeResult.rows[0];
    const points = await getActivePoints(client);
    const destination = nearestPointWithinGeofence(
      points,
      position,
      (point) => Number(point.id) !== Number(active.origen_id)
    );
    if (!destination) {
      await client.query('ROLLBACK');
      return res.status(422).json({
        error: 'No se encontro ningun taller, local o almacen dentro de la geocerca actual.'
      });
    }

    const completed = await client.query(
      `UPDATE entregas_recorridos
       SET destino_id = $1,
           estado = 'ENTREGADA',
           llegada_at = CURRENT_TIMESTAMP,
           llegada_latitud = $2,
           llegada_longitud = $3,
           distancia_destino_metros = $4,
           precision_llegada_metros = $5
       WHERE id = $6
       RETURNING id, salida_at, llegada_at,
         EXTRACT(EPOCH FROM (llegada_at - salida_at))::INTEGER AS duracion_segundos`,
      [destination.id, position.latitud, position.longitud, destination.distance, position.accuracy, active.id]
    );

    await client.query(
      `UPDATE messenger_tracking_state
       SET inside_point_id = $2, last_latitud = $3, last_longitud = $4,
           last_accuracy_metros = $5, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [
        req.user.id,
        ORIGIN_TYPES.has(destination.tipo) ? destination.id : null,
        position.latitud,
        position.longitud,
        position.accuracy
      ]
    );
    await logActivity({
      req,
      action: 'ENTREGA_REALIZADA',
      entityType: 'entrega',
      entityId: completed.rows[0].id,
      details: {
        origen: active.origen_nombre,
        destino: destination.nombre,
        duracion_segundos: completed.rows[0].duracion_segundos
      },
      client
    });
    await client.query('COMMIT');

    return res.status(200).json({
      message: `Entrega registrada en ${destination.nombre}.`,
      delivery: {
        ...completed.rows[0],
        origen_nombre: active.origen_nombre,
        destino_nombre: destination.nombre,
        distancia_destino_metros: Math.round(destination.distance)
      }
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error completing delivery:', error);
    return res.status(500).json({ error: 'No se pudo registrar la entrega.' });
  } finally {
    client.release();
  }
};

const getStatus = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.id, r.estado, r.salida_at, r.llegada_at,
              o.nombre AS origen_nombre, d.nombre AS destino_nombre,
              CASE WHEN r.estado = 'ENTREGADA'
                THEN EXTRACT(EPOCH FROM (r.llegada_at - r.salida_at))::INTEGER
                ELSE EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - r.salida_at))::INTEGER
              END AS duracion_segundos
       FROM entregas_recorridos r
       JOIN talleres o ON o.id = r.origen_id
       LEFT JOIN talleres d ON d.id = r.destino_id
       WHERE r.mensajero_id = $1
       ORDER BY (r.estado = 'EN_RUTA') DESC, r.salida_at DESC
       LIMIT 10`,
      [req.user.id]
    );
    const activeRoute = result.rows.find((route) => route.estado === 'EN_RUTA') || null;
    return res.status(200).json({ activeRoute, recent: result.rows });
  } catch (error) {
    console.error('Error getting delivery status:', error);
    return res.status(500).json({ error: 'No se pudo consultar el estado de entregas.' });
  }
};

const listDeliveries = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.id, r.estado, r.salida_at, r.llegada_at,
              EXTRACT(EPOCH FROM (COALESCE(r.llegada_at, CURRENT_TIMESTAMP) - r.salida_at))::INTEGER AS duracion_segundos,
              r.distancia_destino_metros, r.precision_llegada_metros,
              u.name AS mensajero_nombre,
              o.nombre AS origen_nombre, d.nombre AS destino_nombre
       FROM entregas_recorridos r
       JOIN users u ON u.id = r.mensajero_id
       JOIN talleres o ON o.id = r.origen_id
       LEFT JOIN talleres d ON d.id = r.destino_id
       ORDER BY r.salida_at DESC
       LIMIT 500`
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error listing deliveries:', error);
    return res.status(500).json({ error: 'No se pudo cargar el control de entregas.' });
  }
};

module.exports = {
  registerPosition,
  completeDelivery,
  getStatus,
  listDeliveries,
  distanceInMeters,
  nearestPointWithinGeofence
};
