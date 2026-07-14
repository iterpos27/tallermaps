const db = require('../db');

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : value;
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

    queryText += ` ORDER BY p.fecha_programada ASC, t.nombre ASC`;

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
  const { taller_id, fecha_programada, observacion } = req.body;
  const normalizedDate = normalizeDate(fecha_programada);

  if (!taller_id || !normalizedDate) {
    return res.status(400).json({ error: 'Seleccione un taller y una fecha valida.' });
  }

  try {
    const taller = await db.query('SELECT id FROM talleres WHERE id = $1', [taller_id]);
    if (taller.rows.length === 0) {
      return res.status(404).json({ error: 'Taller no encontrado.' });
    }

    const result = await db.query(
      `INSERT INTO programaciones_visita (taller_id, vendedor_id, fecha_programada, observacion)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (taller_id, vendedor_id, fecha_programada)
       DO UPDATE SET observacion = EXCLUDED.observacion, estado = 'PENDIENTE', updated_at = CURRENT_TIMESTAMP
       RETURNING id, taller_id, vendedor_id, fecha_programada, observacion, estado`,
      [taller_id, vendedorId, normalizedDate, observacion ? observacion.trim() : null]
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
      if (!item.taller_id || !normalizedDate) {
        throw new Error('Cada fila debe tener taller y fecha valida.');
      }

      const result = await client.query(
        `INSERT INTO programaciones_visita (taller_id, vendedor_id, fecha_programada, observacion)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (taller_id, vendedor_id, fecha_programada)
         DO UPDATE SET observacion = EXCLUDED.observacion, estado = 'PENDIENTE', updated_at = CURRENT_TIMESTAMP
         RETURNING id, taller_id, vendedor_id, fecha_programada, observacion, estado`,
        [
          item.taller_id,
          vendedorId,
          normalizedDate,
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
  const { fecha_programada, observacion, estado } = req.body;
  const { role, id: userId } = req.user;
  const normalizedDate = fecha_programada ? normalizeDate(fecha_programada) : null;
  const normalizedEstado = estado ? estado.toUpperCase() : null;

  if (normalizedEstado && !['PENDIENTE', 'EJECUTADA', 'CANCELADA'].includes(normalizedEstado)) {
    return res.status(400).json({ error: 'Estado invalido.' });
  }

  try {
    const params = [
      normalizedDate,
      observacion !== undefined ? observacion.trim() || null : undefined,
      normalizedEstado,
      id
    ];
    let queryText = `
      UPDATE programaciones_visita
      SET
        fecha_programada = COALESCE($1, fecha_programada),
        observacion = COALESCE($2, observacion),
        estado = COALESCE($3, estado),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `;

    if (role === 'VENDEDOR') {
      queryText += ' AND vendedor_id = $5';
      params.push(userId);
    }

    queryText += ' RETURNING id, taller_id, vendedor_id, fecha_programada, observacion, estado, visita_id';

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

    queryText += ` ORDER BY p.fecha_programada ASC, u.name ASC, t.nombre ASC`;

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
