const db = require('../db');
const { storageService } = require('../services/storage');
const { logActivity } = require('../services/audit');

const normalizeVisitDateTime = (date, time) => {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const parsedDate = new Date(`${date}T${time}:00`);
  const [year, month, day] = date.split('-').map(Number);
  if (
    Number.isNaN(parsedDate.getTime())
    || parsedDate.getFullYear() !== year
    || parsedDate.getMonth() + 1 !== month
    || parsedDate.getDate() !== day
  ) return null;
  return `${date} ${time}:00`;
};

/**
 * List visits with optional filters (ADMIN sees all, VENDEDOR sees only their own)
 */
const getVisitas = async (req, res) => {
  const { role, id: userId } = req.user;
  const { search, vendedor_id, fecha_inicio, fecha_fin } = req.query;

  try {
    let queryText = `
      SELECT 
        v.id,
        v.foto_url,
        v.latitud,
        v.longitud,
        COALESCE(v.captured_at, v.fecha_visita::timestamptz) AS fecha_visita,
        v.created_at,
        v.observacion,
        v.programacion_id,
        v.fuera_rango,
        v.distancia_metros,
        p.fecha_programada,
        t.id as taller_id,
        t.nombre as taller_nombre,
        u.id as vendedor_id,
        u.name as vendedor_nombre,
        u.email as vendedor_email
      FROM visitas v
      JOIN talleres t ON v.taller_id = t.id
      JOIN users u ON v.vendedor_id = u.id
      LEFT JOIN programaciones_visita p ON v.programacion_id = p.id
      WHERE 1=1
    `;
    const queryParams = [];
    let paramIndex = 1;

    // Filter by role (Vendedores can only see their own visits)
    if (role === 'VENDEDOR') {
      queryText += ` AND v.vendedor_id = $${paramIndex}`;
      queryParams.push(userId);
      paramIndex++;
    } else if (role === 'ADMIN' && vendedor_id) {
      // Admin can filter by specific vendor
      queryText += ` AND v.vendedor_id = $${paramIndex}`;
      queryParams.push(vendedor_id);
      paramIndex++;
    }

    // Filter by workshop name (search query)
    if (search) {
      queryText += ` AND t.nombre ILIKE $${paramIndex}`;
      queryParams.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Filter by date range (fecha_inicio / fecha_fin)
    if (fecha_inicio) {
      queryText += ` AND v.fecha_visita >= $${paramIndex}::date`;
      queryParams.push(fecha_inicio);
      paramIndex++;
    }
    if (fecha_fin) {
      queryText += ` AND v.fecha_visita < ($${paramIndex}::date + INTERVAL '1 day')`;
      queryParams.push(fecha_fin);
      paramIndex++;
    }

    queryText += ` ORDER BY v.fecha_visita DESC`;

    const result = await db.query(queryText, queryParams);
    return res.status(200).json(result.rows);

  } catch (error) {
    console.error('Error fetching visits:', error);
    return res.status(500).json({ 
      error: 'Error al obtener el listado de visitas.' 
    });
  }
};

/**
 * Get single visit by ID
 */
const getVisitaById = async (req, res) => {
  const { id } = req.params;
  const { role, id: userId } = req.user;

  try {
    const result = await db.query(`
      SELECT 
        v.id,
        v.foto_url,
        v.latitud,
        v.longitud,
        COALESCE(v.captured_at, v.fecha_visita::timestamptz) AS fecha_visita,
        v.created_at,
        v.observacion,
        v.programacion_id,
        v.fuera_rango,
        v.distancia_metros,
        p.fecha_programada,
        t.id as taller_id,
        t.nombre as taller_nombre,
        u.id as vendedor_id,
        u.name as vendedor_nombre,
        u.email as vendedor_email
      FROM visitas v
      JOIN talleres t ON v.taller_id = t.id
      JOIN users u ON v.vendedor_id = u.id
      LEFT JOIN programaciones_visita p ON v.programacion_id = p.id
      WHERE v.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Visita no encontrada.' });
    }

    const visita = result.rows[0];

    // Restrict access: Vendedores can only view their own visits
    if (role === 'VENDEDOR' && visita.vendedor_id !== userId) {
      return res.status(403).json({ error: 'Acceso no autorizado a esta visita.' });
    }

    return res.status(200).json(visita);

  } catch (error) {
    console.error('Error fetching visit by ID:', error);
    return res.status(500).json({ 
      error: 'Error al obtener los detalles de la visita.' 
    });
  }
};

/**
 * Update only the date and time of a visit. Sellers can edit only their own visits.
 */
const updateVisitaDateTime = async (req, res) => {
  const { id } = req.params;
  const { fecha, hora } = req.body;
  const normalizedDateTime = normalizeVisitDateTime(fecha, hora);

  if (!/^\d+$/.test(id) || !normalizedDateTime) {
    return res.status(400).json({ error: 'Ingrese una fecha y hora válidas.' });
  }

  try {
    const params = [normalizedDateTime, id];
    let queryText = `
      UPDATE visitas
      SET fecha_visita = $1::timestamp, captured_at = $1::timestamp AT TIME ZONE 'America/Guayaquil'
      WHERE id = $2
    `;

    if (req.user.role === 'VENDEDOR') {
      queryText += ' AND vendedor_id = $3';
      params.push(req.user.id);
    }

    queryText += ' RETURNING id, taller_id, vendedor_id, captured_at AS fecha_visita, fuera_rango';
    const result = await db.query(queryText, params);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Visita no encontrada o sin permisos para editarla.' });
    }

    await logActivity({
      req,
      action: 'VISITA_FECHA_ACTUALIZADA',
      entityType: 'visita',
      entityId: id,
      details: { fecha_visita: result.rows[0].fecha_visita }
    });

    return res.status(200).json({
      message: 'Fecha y hora actualizadas correctamente.',
      visita: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating visit date and time:', error);
    return res.status(500).json({ error: 'Error al actualizar la fecha y hora de la visita.' });
  }
};

const createVisita = require('./registerVisit');

/**
 * Permanently delete a visit. Sellers can delete only their own visits.
 * If the visit completed a schedule, that schedule becomes pending again.
 */
const deleteVisita = async (req, res) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Identificador de visita invalido.' });
  }

  const client = await db.pool.connect();
  let visita;

  try {
    await client.query('BEGIN');
    const visitResult = await client.query(
      `SELECT v.id, v.foto_url, v.programacion_id, v.vendedor_id, t.nombre AS taller_nombre,
              u.name AS vendedor_nombre
       FROM visitas v
       JOIN talleres t ON t.id = v.taller_id
       JOIN users u ON u.id = v.vendedor_id
       WHERE v.id = $1
       FOR UPDATE OF v`,
      [id]
    );

    if (visitResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Visita no encontrada.' });
    }

    visita = visitResult.rows[0];
    if (req.user.role === 'VENDEDOR' && Number(visita.vendedor_id) !== Number(req.user.id)) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'No puede eliminar la visita de otro vendedor.' });
    }
    await client.query(
      `UPDATE programaciones_visita
       SET estado = 'PENDIENTE', visita_id = NULL, iniciada_at = NULL, finalizada_at = NULL,
           motivo_fallo = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE visita_id = $1`,
      [id]
    );
    await client.query('DELETE FROM visitas WHERE id = $1', [id]);
    await logActivity({
      req,
      action: 'VISITA_ELIMINADA',
      entityType: 'visita',
      entityId: id,
      details: { taller: visita.taller_nombre, vendedor: visita.vendedor_nombre },
      client
    });
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error deleting visit:', error);
    return res.status(500).json({ error: 'Error al eliminar la visita.' });
  } finally {
    client.release();
  }

  // Remove the file only after the database transaction has committed.
  await storageService.deleteFile(visita.foto_url);
  return res.status(200).json({ message: 'Visita eliminada exitosamente.' });
};

module.exports = {
  getVisitas,
  getVisitaById,
  createVisita,
  updateVisitaDateTime,
  deleteVisita
};
