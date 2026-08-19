const db = require('../db');
const { sellerCanAccessWorkshop } = require('../services/sectorAccess');
const { optimizeStops } = require('../utils/routeOptimization');

const ROUTE_STATES = ['PENDIENTE', 'EN_CAMINO', 'INICIADA', 'EJECUTADA', 'FALLIDA', 'REPROGRAMADA', 'CANCELADA'];
const SELLER_TRANSITIONS = {
  PENDIENTE: ['EN_CAMINO', 'REPROGRAMADA', 'CANCELADA'],
  EN_CAMINO: ['PENDIENTE', 'INICIADA', 'FALLIDA', 'REPROGRAMADA'],
  INICIADA: ['FALLIDA', 'REPROGRAMADA'],
  FALLIDA: ['REPROGRAMADA', 'PENDIENTE'],
  REPROGRAMADA: ['PENDIENTE'],
  EJECUTADA: [],
  CANCELADA: ['PENDIENTE']
};

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : value;
};

const normalizeTime = (value) => {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  return value;
};

const normalizeDuration = (value) => {
  const duration = Number(value);
  return Number.isInteger(duration) && duration >= 1 && duration <= 30 ? duration : null;
};

const hasScheduleConflict = async (queryable, vendedorId, date, time, duration, excludedId = null) => {
  const result = await queryable.query(
    `SELECT id
     FROM programaciones_visita
     WHERE vendedor_id = $1
       AND fecha_programada = $2
       AND estado <> 'CANCELADA'
       AND hora_programada < ($3::time + ($4::integer * INTERVAL '1 minute'))
       AND (hora_programada + (duracion_minutos * INTERVAL '1 minute')) > $3::time
       AND ($5::integer IS NULL OR id <> $5)
     LIMIT 1`,
    [vendedorId, date, time, duration, excludedId]
  );
  return result.rows.length > 0;
};

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
        v.fecha_visita,
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

const createProgramacion = async (req, res) => {
  const vendedorId = req.user.role === 'ADMIN' && req.body.vendedor_id
    ? req.body.vendedor_id
    : req.user.id;
  const { taller_id, fecha_programada, hora_programada, duracion_minutos, observacion } = req.body;
  const normalizedDate = normalizeDate(fecha_programada);
  const normalizedTime = normalizeTime(hora_programada);
  const normalizedDuration = normalizeDuration(duracion_minutos);

  if (!taller_id || !normalizedDate || !normalizedTime || !normalizedDuration) {
    return res.status(400).json({ error: 'Seleccione taller, fecha, hora y una duración máxima de 30 minutos.' });
  }

  try {
    const taller = await db.query('SELECT id FROM talleres WHERE id = $1 AND is_active = TRUE', [taller_id]);
    if (taller.rows.length === 0) {
      return res.status(404).json({ error: 'Taller no encontrado.' });
    }

    if (!await sellerCanAccessWorkshop(db, vendedorId, taller_id)) {
      return res.status(403).json({ error: 'El taller no pertenece a un sector asignado al vendedor.' });
    }

    if (await hasScheduleConflict(db, vendedorId, normalizedDate, normalizedTime, normalizedDuration)) {
      return res.status(409).json({ error: 'La hora seleccionada se cruza con otra visita programada.' });
    }

    const result = await db.query(
      `INSERT INTO programaciones_visita
         (taller_id, vendedor_id, fecha_programada, hora_programada, duracion_minutos, observacion)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (taller_id, vendedor_id, fecha_programada, hora_programada)
       DO UPDATE SET duracion_minutos = EXCLUDED.duracion_minutos, observacion = EXCLUDED.observacion,
                     estado = 'PENDIENTE', orden_ruta = NULL, iniciada_at = NULL, finalizada_at = NULL,
                     motivo_fallo = NULL, updated_at = CURRENT_TIMESTAMP
       RETURNING id, taller_id, vendedor_id, fecha_programada, hora_programada, duracion_minutos, observacion, estado`,
      [taller_id, vendedorId, normalizedDate, normalizedTime, normalizedDuration, observacion ? observacion.trim() : null]
    );

    return res.status(201).json({
      message: 'Visita programada exitosamente.',
      programacion: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating schedule:', error);
    return res.status(500).json({ error: 'Error al programar la visita.' });
  }
};

const createProgramacionesBatch = async (req, res) => {
  const { items } = req.body;
  const vendedorId = req.user.role === 'ADMIN' && req.body.vendedor_id
    ? req.body.vendedor_id
    : req.user.id;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Agregue al menos una visita a la programacion semanal.' });
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');
    const created = [];

    for (const item of items) {
      const normalizedDate = normalizeDate(item.fecha_programada);
      const normalizedTime = normalizeTime(item.hora_programada);
      const normalizedDuration = normalizeDuration(item.duracion_minutos);
      if (!item.taller_id || !normalizedDate || !normalizedTime || !normalizedDuration) {
        throw new Error('Cada visita debe tener taller, fecha, hora y una duración máxima de 30 minutos.');
      }

      if (!await sellerCanAccessWorkshop(client, vendedorId, item.taller_id)) {
        throw new Error('Uno de los talleres no pertenece a un sector asignado al vendedor.');
      }

      if (await hasScheduleConflict(client, vendedorId, normalizedDate, normalizedTime, normalizedDuration)) {
        throw new Error('Una de las horas seleccionadas se cruza con otra visita programada.');
      }

      const result = await client.query(
        `INSERT INTO programaciones_visita
           (taller_id, vendedor_id, fecha_programada, hora_programada, duracion_minutos, observacion)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (taller_id, vendedor_id, fecha_programada, hora_programada)
         DO UPDATE SET duracion_minutos = EXCLUDED.duracion_minutos, observacion = EXCLUDED.observacion,
                       estado = 'PENDIENTE', orden_ruta = NULL, iniciada_at = NULL, finalizada_at = NULL,
                       motivo_fallo = NULL, updated_at = CURRENT_TIMESTAMP
         RETURNING id, taller_id, vendedor_id, fecha_programada, hora_programada, duracion_minutos, observacion, estado`,
        [
          item.taller_id,
          vendedorId,
          normalizedDate,
          normalizedTime,
          normalizedDuration,
          item.observacion ? item.observacion.trim() : null
        ]
      );
      created.push(result.rows[0]);
    }

    await client.query('COMMIT');
    return res.status(201).json({
      message: 'Programacion semanal guardada exitosamente.',
      programaciones: created
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating weekly schedule:', error);
    return res.status(400).json({ error: error.message || 'Error al guardar la programacion semanal.' });
  } finally {
    client.release();
  }
};

const updateProgramacion = async (req, res) => {
  const { id } = req.params;
  const { fecha_programada, hora_programada, duracion_minutos, observacion, estado, motivo_fallo } = req.body;
  const { role, id: userId } = req.user;
  const normalizedDate = fecha_programada ? normalizeDate(fecha_programada) : null;
  const normalizedTime = hora_programada ? normalizeTime(hora_programada) : null;
  const normalizedDuration = duracion_minutos !== undefined ? normalizeDuration(duracion_minutos) : null;
  const normalizedEstado = estado ? estado.toUpperCase() : null;

  if (normalizedEstado && !ROUTE_STATES.includes(normalizedEstado)) {
    return res.status(400).json({ error: 'Estado invalido.' });
  }
  if (normalizedEstado === 'FALLIDA' && (typeof motivo_fallo !== 'string' || motivo_fallo.trim().length < 5)) {
    return res.status(400).json({ error: 'Ingrese un motivo de al menos 5 caracteres para la visita fallida.' });
  }
  if (hora_programada !== undefined && !normalizedTime) {
    return res.status(400).json({ error: 'La hora programada no es válida.' });
  }
  if (duracion_minutos !== undefined && !normalizedDuration) {
    return res.status(400).json({ error: 'La duración debe estar entre 1 y 30 minutos.' });
  }

  try {
    const currentResult = await db.query(
      `SELECT id, vendedor_id, estado, fecha_programada, hora_programada, duracion_minutos
       FROM programaciones_visita
       WHERE id = $1`,
      [id]
    );
    if (currentResult.rows.length === 0) return res.status(404).json({ error: 'Programacion no encontrada.' });
    const current = currentResult.rows[0];
    if (role === 'VENDEDOR' && Number(current.vendedor_id) !== Number(userId)) {
      return res.status(403).json({ error: 'No puede modificar una programación de otro vendedor.' });
    }
    if (role === 'VENDEDOR' && normalizedEstado && !SELLER_TRANSITIONS[current.estado]?.includes(normalizedEstado)) {
      return res.status(409).json({ error: `No se puede cambiar de ${current.estado} a ${normalizedEstado}.` });
    }
    if ((normalizedDate || normalizedTime || normalizedDuration) && await hasScheduleConflict(
      db,
      current.vendedor_id,
      normalizedDate || current.fecha_programada,
      normalizedTime || String(current.hora_programada).slice(0, 5),
      normalizedDuration || current.duracion_minutos,
      Number(id)
    )) {
      return res.status(409).json({ error: 'La nueva hora se cruza con otra visita programada.' });
    }

    const params = [
      normalizedDate,
      observacion !== undefined ? observacion.trim() || null : undefined,
      normalizedEstado,
      normalizedTime,
      normalizedDuration,
      id,
      motivo_fallo !== undefined ? motivo_fallo.trim() || null : undefined
    ];
    let queryText = `
      UPDATE programaciones_visita
      SET
        fecha_programada = COALESCE($1, fecha_programada),
        observacion = COALESCE($2, observacion),
        estado = COALESCE($3, estado),
        hora_programada = COALESCE($4, hora_programada),
        duracion_minutos = COALESCE($5, duracion_minutos),
        motivo_fallo = CASE
          WHEN $3 = 'FALLIDA' THEN $7
          WHEN $3 IS NOT NULL THEN NULL
          ELSE motivo_fallo
        END,
        iniciada_at = CASE WHEN $3 = 'INICIADA' THEN COALESCE(iniciada_at, CURRENT_TIMESTAMP) ELSE iniciada_at END,
        finalizada_at = CASE
          WHEN $3 IN ('EJECUTADA', 'FALLIDA', 'REPROGRAMADA', 'CANCELADA') THEN CURRENT_TIMESTAMP
          WHEN $3 IN ('PENDIENTE', 'EN_CAMINO', 'INICIADA') THEN NULL
          ELSE finalizada_at
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
    `;

    if (role === 'VENDEDOR') {
      queryText += ' AND vendedor_id = $8';
      params.push(userId);
    }

    queryText += ' RETURNING id, taller_id, vendedor_id, fecha_programada, hora_programada, duracion_minutos, observacion, estado, motivo_fallo, iniciada_at, finalizada_at, orden_ruta, visita_id';

    const result = await db.query(queryText, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Programacion no encontrada.' });
    }

    return res.status(200).json({
      message: 'Programacion actualizada exitosamente.',
      programacion: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
    return res.status(500).json({ error: 'Error al actualizar la programacion.' });
  }
};

const optimizeTodayRoute = async (req, res) => {
  if (req.user.role !== 'VENDEDOR') {
    return res.status(403).json({ error: 'La optimización de ruta está disponible para vendedores.' });
  }
  const latitude = Number(req.body.latitud);
  const longitude = Number(req.body.longitud);
  const date = normalizeDate(req.body.fecha);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
    || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !date) {
    return res.status(400).json({ error: 'No se recibió una ubicación o fecha válida.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
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
        v.fecha_visita
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
