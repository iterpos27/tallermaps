const db = require('../db');
const { logActivity, safeLogActivity } = require('../services/audit');
const { isNonEmptyString, isValidEmail, isValidLatitude, isValidLongitude } = require('../utils/validation');

/**
 * List all workshops (talleres)
 */
const getTalleres = async (req, res) => {
  const includeDeleted = req.user?.role === 'ADMIN' && req.query.include_deleted === 'true';
  const isCompanyPointRequest = req.user?.role === 'ADMIN' && req.query.tipo === 'EMPRESA';
  try {
    const result = await db.query(`
      WITH latest_visitas AS (
        SELECT DISTINCT ON (v.taller_id)
          v.taller_id,
          v.fecha_visita,
          v.vendedor_id
        FROM visitas v
        ORDER BY v.taller_id, v.fecha_visita DESC
      )
      SELECT
        t.id,
        t.nombre,
        t.latitud,
        t.longitud,
        t.propietario,
        t.telefono,
        t.direccion,
        t.correo,
        t.observaciones,
        t.tipo,
        t.radio_geocerca_metros,
        t.is_active,
        t.deleted_at,
        t.created_at,
        lv.fecha_visita AS ultima_fecha_visita,
        u.name AS ultimo_vendedor_nombre
      FROM talleres t
      LEFT JOIN latest_visitas lv ON lv.taller_id = t.id
      LEFT JOIN users u ON u.id = lv.vendedor_id
      WHERE ($1::boolean = TRUE OR t.is_active = TRUE)
        AND (
          ($2::boolean = TRUE AND t.tipo IN ('MATRIZ', 'LOCAL', 'ALMACEN'))
          OR ($2::boolean = FALSE AND t.tipo = 'TALLER')
        )
      ORDER BY t.nombre ASC
    `, [includeDeleted, isCompanyPointRequest]);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching talleres:', error);
    return res.status(500).json({ 
      error: 'Error al obtener los talleres.' 
    });
  }
};

/**
 * Get workshop by ID
 */
const getTallerById = async (req, res) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT id, nombre, latitud, longitud, propietario, telefono, direccion, correo, observaciones,
              tipo, radio_geocerca_metros, is_active, deleted_at, created_at
       FROM talleres
       WHERE id = $1 AND (is_active = TRUE OR $2 = 'ADMIN')`,
      [id, req.user.role]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Taller no encontrado.' });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching taller by ID:', error);
    return res.status(500).json({ 
      error: 'Error al obtener los detalles del taller.' 
    });
  }
};

/**
 * Create a new workshop
 */
const createTaller = async (req, res) => {
  const { nombre, latitud, longitud, tipo, radio_geocerca_metros } = req.body;
  const normalizedType = req.user.role === 'ADMIN' ? String(tipo || 'TALLER').toUpperCase() : 'TALLER';
  const geofenceRadius = req.user.role === 'ADMIN' ? Number(radio_geocerca_metros || 100) : 100;

  if (!isNonEmptyString(nombre) || !isValidLatitude(latitud) || !isValidLongitude(longitud)) {
    return res.status(400).json({ error: 'Ingrese un nombre y coordenadas GPS válidas.' });
  }
  if (!['TALLER', 'MATRIZ', 'LOCAL', 'ALMACEN'].includes(normalizedType)) {
    return res.status(400).json({ error: 'El tipo de punto no es válido.' });
  }
  if (req.user.role === 'ADMIN' && normalizedType === 'TALLER') {
    return res.status(403).json({ error: 'Los talleres deben ser registrados por un vendedor o mensajero.' });
  }
  if (!Number.isInteger(geofenceRadius) || geofenceRadius < 20 || geofenceRadius > 1000) {
    return res.status(400).json({ error: 'El radio de geocerca debe estar entre 20 y 1000 metros.' });
  }

  try {
    const existingResult = await db.query(
      'SELECT id FROM talleres WHERE LOWER(nombre) = LOWER($1)',
      [nombre.trim()]
    );
    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'Ya existe un taller registrado con ese nombre.' });
    }

    const result = await db.query(
      `INSERT INTO talleres (nombre, latitud, longitud, tipo, radio_geocerca_metros)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, latitud, longitud, tipo, radio_geocerca_metros, created_at`,
      [nombre.trim(), latitud, longitud, normalizedType, geofenceRadius]
    );

    await safeLogActivity({
      req,
      action: 'TALLER_CREADO',
      entityType: 'taller',
      entityId: result.rows[0].id,
      details: { nombre: result.rows[0].nombre, tipo: result.rows[0].tipo }
    });

    return res.status(201).json({ message: 'Punto registrado exitosamente.', taller: result.rows[0] });
  } catch (error) {
    console.error('Error creating taller:', error);
    return res.status(500).json({ error: 'Error al registrar el punto.' });
  }
};

/**
 * Update an existing workshop
 */
const updateTaller = async (req, res) => {
  const { id } = req.params;
  const { nombre, latitud, longitud, propietario, telefono, direccion, correo, observaciones, tipo, radio_geocerca_metros } = req.body;
  const normalizedType = String(tipo || 'TALLER').toUpperCase();
  const geofenceRadius = Number(radio_geocerca_metros || 100);

  if (!isNonEmptyString(nombre) || !isValidLatitude(latitud) || !isValidLongitude(longitud)) {
    return res.status(400).json({ 
      error: 'Ingrese un nombre y coordenadas GPS válidas.'
    });
  }

  if (correo && !isValidEmail(correo)) {
    return res.status(400).json({ error: 'Ingrese un correo electrónico válido.' });
  }

  if (!['TALLER', 'MATRIZ', 'LOCAL', 'ALMACEN'].includes(normalizedType)) {
    return res.status(400).json({ error: 'El tipo de punto no es valido.' });
  }
  if (!Number.isInteger(geofenceRadius) || geofenceRadius < 20 || geofenceRadius > 1000) {
    return res.status(400).json({ error: 'El radio de geocerca debe estar entre 20 y 1000 metros.' });
  }

  try {
    // Check if workshop exists
    const checkRes = await db.query('SELECT id FROM talleres WHERE id = $1 AND is_active = TRUE', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Taller no encontrado.' });
    }

    // Check if another workshop already has this name (case-insensitive)
    const nameCheck = await db.query(
      'SELECT id FROM talleres WHERE LOWER(nombre) = LOWER($1) AND id <> $2',
      [nombre.trim(), id]
    );
    if (nameCheck.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Ya existe otro taller registrado con ese nombre.' 
      });
    }

    const result = await db.query(
      `UPDATE talleres 
       SET nombre = $1, latitud = $2, longitud = $3, propietario = $4, telefono = $5,
           direccion = $6, correo = $7, observaciones = $8, tipo = $9, radio_geocerca_metros = $10
       WHERE id = $11
       RETURNING id, nombre, latitud, longitud, propietario, telefono, direccion, correo,
                 observaciones, tipo, radio_geocerca_metros, created_at`,
      [
        nombre.trim(), 
        latitud, 
        longitud, 
        propietario ? propietario.trim() : null, 
        telefono ? telefono.trim() : null, 
        direccion ? direccion.trim() : null, 
        correo ? correo.trim() : null, 
        observaciones ? observaciones.trim() : null,
        normalizedType,
        geofenceRadius,
        id
      ]
    );

    await safeLogActivity({
      req,
      action: 'TALLER_ACTUALIZADO',
      entityType: 'taller',
      entityId: result.rows[0].id,
      details: {
        nombre: result.rows[0].nombre,
        tipo: result.rows[0].tipo,
        radio_geocerca_metros: result.rows[0].radio_geocerca_metros
      }
    });

    return res.status(200).json({
      message: 'Taller actualizado exitosamente.',
      taller: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating taller:', error);
    return res.status(500).json({ 
      error: 'Error al actualizar el taller.' 
    });
  }
};

/**
 * Archive a workshop while preserving its visits, photos and schedules for auditing.
 */
const deleteTaller = async (req, res) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Identificador de taller inválido.' });
  }

  let client;

  try {
    client = await db.pool.connect();
    await client.query('BEGIN');

    const tallerResult = await client.query(
      'SELECT id, nombre FROM talleres WHERE id = $1 AND is_active = TRUE FOR UPDATE',
      [id]
    );

    if (tallerResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Taller no encontrado.' });
    }

    await client.query(
      `UPDATE talleres
       SET is_active = FALSE, deleted_at = CURRENT_TIMESTAMP, deleted_by = $2
       WHERE id = $1`,
      [id, req.user.id]
    );
    await logActivity({
      req,
      action: 'TALLER_ARCHIVADO',
      entityType: 'taller',
      entityId: id,
      details: { nombre: tallerResult.rows[0].nombre },
      client
    });
    await client.query('COMMIT');

    return res.status(200).json({
      message: 'Taller eliminado del sistema y del mapa. Su historial fue conservado.',
      taller: tallerResult.rows[0]
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Error deleting taller:', error);
    return res.status(500).json({
      error: 'Error al eliminar el taller.'
    });
  } finally {
    if (client) client.release();
  }
};

const restoreTaller = async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ error: 'Identificador de taller inválido.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `UPDATE talleres
       SET is_active = TRUE, deleted_at = NULL, deleted_by = NULL
       WHERE id = $1 AND is_active = FALSE
       RETURNING id, nombre`,
      [id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Taller eliminado no encontrado.' });
    }

    await logActivity({
      req,
      action: 'TALLER_RESTAURADO',
      entityType: 'taller',
      entityId: id,
      details: { nombre: result.rows[0].nombre },
      client
    });
    await client.query('COMMIT');
    return res.status(200).json({ message: 'Taller restaurado exitosamente.', taller: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Error restoring taller:', error);
    return res.status(500).json({ error: 'Error al restaurar el taller.' });
  } finally {
    client.release();
  }
};

/**
 * Get visit history for a specific workshop
 */
const getTallerVisitas = async (req, res) => {
  const { id } = req.params;

  try {
    // Check if workshop exists
    const checkRes = await db.query(
      `SELECT id FROM talleres WHERE id = $1 AND (is_active = TRUE OR $2 = 'ADMIN')`,
      [id, req.user.role]
    );
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Taller no encontrado.' });
    }

    const result = await db.query(
      `SELECT 
        v.id, 
        v.foto_url, 
        v.latitud, 
        v.longitud, 
        v.fecha_visita,
        v.observacion,
        v.programacion_id,
        v.fuera_rango,
        v.distancia_metros,
        u.name as vendedor_nombre
       FROM visitas v
       JOIN users u ON v.vendedor_id = u.id
       WHERE v.taller_id = $1
       ORDER BY v.fecha_visita DESC`,
      [id]
    );

    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching workshop visits:', error);
    return res.status(500).json({ 
      error: 'Error al obtener el historial de visitas del taller.' 
    });
  }
};

module.exports = {
  getTalleres,
  getTallerById,
  createTaller,
  updateTaller,
  deleteTaller,
  restoreTaller,
  getTallerVisitas
};
