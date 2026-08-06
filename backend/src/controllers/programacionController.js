const db = require('../db');

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

const hasScheduleConflict = async (queryable, vendedorId, date, time, duration) => {
  const result = await queryable.query(
    `SELECT id
     FROM programaciones_visita
     WHERE vendedor_id = $1
       AND fecha_programada = $2
       AND estado <> 'CANCELADA'
       AND hora_programada < ($3::time + ($4::integer * INTERVAL '1 minute'))
       AND (hora_programada + (duracion_minutos * INTERVAL '1 minute')) > $3::time
     LIMIT 1`,
    [vendedorId, date, time, duration]
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
        p.visita_id,
        v.fecha_visita,
        v.observacion AS visita_observacion,
        p.created_at,
        p.updated_at
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

    if (estado) {
      queryText += ` AND p.estado = $${paramIndex}`;
      params.push(estado.toUpperCase());
      paramIndex++;
    }

    queryText += ` ORDER BY p.fecha_programada ASC, p.hora_programada ASC, t.nombre ASC`;

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

    if (await hasScheduleConflict(db, vendedorId, normalizedDate, normalizedTime, normalizedDuration)) {
      return res.status(409).json({ error: 'La hora seleccionada se cruza con otra visita programada.' });
    }

    const result = await db.query(
      `INSERT INTO programaciones_visita
         (taller_id, vendedor_id, fecha_programada, hora_programada, duracion_minutos, observacion)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (taller_id, vendedor_id, fecha_programada, hora_programada)
       DO UPDATE SET duracion_minutos = EXCLUDED.duracion_minutos, observacion = EXCLUDED.observacion,
                     estado = 'PENDIENTE', updated_at = CURRENT_TIMESTAMP
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

      if (await hasScheduleConflict(client, vendedorId, normalizedDate, normalizedTime, normalizedDuration)) {
        throw new Error('Una de las horas seleccionadas se cruza con otra visita programada.');
      }

      const result = await client.query(
        `INSERT INTO programaciones_visita
           (taller_id, vendedor_id, fecha_programada, hora_programada, duracion_minutos, observacion)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (taller_id, vendedor_id, fecha_programada, hora_programada)
         DO UPDATE SET duracion_minutos = EXCLUDED.duracion_minutos, observacion = EXCLUDED.observacion,
                       estado = 'PENDIENTE', updated_at = CURRENT_TIMESTAMP
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
  const { fecha_programada, hora_programada, duracion_minutos, observacion, estado } = req.body;
  const { role, id: userId } = req.user;
  const normalizedDate = fecha_programada ? normalizeDate(fecha_programada) : null;
  const normalizedTime = hora_programada ? normalizeTime(hora_programada) : null;
  const normalizedDuration = duracion_minutos !== undefined ? normalizeDuration(duracion_minutos) : null;
  const normalizedEstado = estado ? estado.toUpperCase() : null;

  if (normalizedEstado && !['PENDIENTE', 'EJECUTADA', 'CANCELADA'].includes(normalizedEstado)) {
    return res.status(400).json({ error: 'Estado invalido.' });
  }
  if (hora_programada !== undefined && !normalizedTime) {
    return res.status(400).json({ error: 'La hora programada no es válida.' });
  }
  if (duracion_minutos !== undefined && !normalizedDuration) {
    return res.status(400).json({ error: 'La duración debe estar entre 1 y 30 minutos.' });
  }

  try {
    const params = [
      normalizedDate,
      observacion !== undefined ? observacion.trim() || null : undefined,
      normalizedEstado,
      normalizedTime,
      normalizedDuration,
      id
    ];
    let queryText = `
      UPDATE programaciones_visita
      SET
        fecha_programada = COALESCE($1, fecha_programada),
        observacion = COALESCE($2, observacion),
        estado = COALESCE($3, estado),
        hora_programada = COALESCE($4, hora_programada),
        duracion_minutos = COALESCE($5, duracion_minutos),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
    `;

    if (role === 'VENDEDOR') {
      queryText += ' AND vendedor_id = $7';
      params.push(userId);
    }

    queryText += ' RETURNING id, taller_id, vendedor_id, fecha_programada, hora_programada, duracion_minutos, observacion, estado, visita_id';

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
  getReporteProgramacion
};
