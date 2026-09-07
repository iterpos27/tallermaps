const db = require('../db');
const { normalizeDate, isValidLatitude, isValidLongitude } = require('../utils/validation');
const { optimizeStops } = require('../utils/routeOptimization');

const getProgramaciones = async (req, res) => {
  const { role, id: userId } = req.user;
  const { vendedor_id, fecha_inicio, fecha_fin, estado } = req.query;

  try {
    const params = [];
    let paramIndex = 1;
    let queryText = `
      SELECT
        p.id,
        p.taller_id,
        t.nombre AS taller_nombre,
        p.vendedor_id,
        u.name AS vendedor_nombre,
        p.fecha_programada,
        p.hora_programada,
        p.duracion_minutos,
        p.observacion,
        p.estado,
        p.orden_ruta,
        p.iniciada_at,
        p.finalizada_at,
        p.motivo_fallo,
        p.visita_id,
        t.latitud AS taller_latitud,
        t.longitud AS taller_longitud,
        t.direccion AS taller_direccion,
        COALESCE(s.nombre, t.sector) AS sector_nombre,
        COALESCE(v.captured_at, v.fecha_visita::timestamptz) AS fecha_visita,
        v.observacion AS visita_observacion,
        p.created_at,
        p.updated_at
      FROM programaciones_visita p
      JOIN talleres t ON p.taller_id = t.id
      LEFT JOIN sectores s ON s.id = t.sector_id
      JOIN users u ON p.vendedor_id = u.id
      LEFT JOIN visitas v ON p.visita_id = v.id
      WHERE 1=1
    `;

    if (role === 'VENDEDOR') {
      queryText += ` AND p.vendedor_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    } else if (vendedor_id) {
      queryText += ` AND p.vendedor_id = $${paramIndex}`;
      params.push(vendedor_id);
      paramIndex++;
    }

    if (fecha_inicio) {
      queryText += ` AND p.fecha_programada >= $${paramIndex}`;
      params.push(fecha_inicio);
      paramIndex++;
    }

    if (fecha_fin) {
      queryText += ` AND p.fecha_programada <= $${paramIndex}`;
      params.push(fecha_fin);
      paramIndex++;
    }

    if (estado) {
      queryText += ` AND p.estado = $${paramIndex}`;
      params.push(estado.toUpperCase());
      paramIndex++;
    }

    queryText += ` ORDER BY p.fecha_programada ASC, p.orden_ruta ASC NULLS LAST, p.hora_programada ASC, t.nombre ASC`;

    const result = await db.query(queryText, params);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching schedules:', error);
    return res.status(500).json({ error: 'Error al obtener la programacion de visitas.' });
  }
};

const { createProgramacion, createProgramacionesBatch, updateProgramacion } = require('./scheduleMutations');

const optimizeTodayRoute = async (req, res) => {
  if (req.user.role !== 'VENDEDOR') {
    return res.status(403).json({ error: 'La optimización de ruta está disponible para vendedores.' });
  }
  const latitude = Number(req.body.latitud);
  const longitude = Number(req.body.longitud);
  const date = normalizeDate(req.body.fecha);
  if (!isValidLatitude(req.body.latitud) || !isValidLongitude(req.body.longitud) || !date) {
    return res.status(400).json({ error: 'No se recibió una ubicación o fecha válida.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(74003, $1::integer)', [req.user.id]);
    const result = await client.query(
      `SELECT p.id, p.taller_id, t.nombre AS taller_nombre, t.latitud, t.longitud
       FROM programaciones_visita p
       JOIN talleres t ON t.id = p.taller_id
       WHERE p.vendedor_id = $1
         AND p.fecha_programada = $2
         AND p.estado IN ('PENDIENTE', 'EN_CAMINO', 'INICIADA', 'REPROGRAMADA')
       FOR UPDATE OF p`,
      [req.user.id, date]
    );

    const ordered = optimizeStops({ latitude, longitude }, result.rows);

    for (let index = 0; index < ordered.length; index += 1) {
      await client.query(
        `UPDATE programaciones_visita SET orden_ruta = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [index + 1, ordered[index].id]
      );
    }
    await client.query('COMMIT');
    return res.status(200).json({ message: 'Ruta optimizada.', paradas: ordered });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error optimizing daily route:', error);
    return res.status(500).json({ error: 'No se pudo optimizar la ruta de hoy.' });
  } finally {
    client.release();
  }
};

const getReporteProgramacion = async (req, res) => {
  const { role, id: userId } = req.user;
  const { vendedor_id, fecha_inicio, fecha_fin } = req.query;

  try {
    const params = [];
    let paramIndex = 1;
    let queryText = `
      SELECT
        t.nombre AS taller_nombre,
        COALESCE(v.fecha_visita::date, p.fecha_programada) AS fecha,
        u.name AS vendedor_nombre,
        COALESCE(NULLIF(v.observacion, ''), p.observacion, '') AS observacion,
        p.estado,
        p.fecha_programada,
        p.hora_programada,
        p.duracion_minutos,
        COALESCE(v.captured_at, v.fecha_visita::timestamptz) AS fecha_visita
      FROM programaciones_visita p
      JOIN talleres t ON p.taller_id = t.id
      JOIN users u ON p.vendedor_id = u.id
      LEFT JOIN visitas v ON p.visita_id = v.id
      WHERE 1=1
    `;

    if (role === 'VENDEDOR') {
      queryText += ` AND p.vendedor_id = $${paramIndex}`;
      params.push(userId);
      paramIndex++;
    } else if (vendedor_id) {
      queryText += ` AND p.vendedor_id = $${paramIndex}`;
      params.push(vendedor_id);
      paramIndex++;
    }

    if (fecha_inicio) {
      queryText += ` AND p.fecha_programada >= $${paramIndex}`;
      params.push(fecha_inicio);
      paramIndex++;
    }

    if (fecha_fin) {
      queryText += ` AND p.fecha_programada <= $${paramIndex}`;
      params.push(fecha_fin);
      paramIndex++;
    }

    queryText += ` ORDER BY p.fecha_programada ASC, p.hora_programada ASC, u.name ASC, t.nombre ASC`;

    const result = await db.query(queryText, params);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching schedule report:', error);
    return res.status(500).json({ error: 'Error al obtener el reporte de programacion.' });
  }
};

module.exports = {
  getProgramaciones,
  createProgramacion,
  createProgramacionesBatch,
  updateProgramacion,
  optimizeTodayRoute,
  getReporteProgramacion
};
