const db = require('../db');
const { transaction } = require('../services/transactions');
const { validateWorkshopLocation } = require('../services/workshopGeofence');
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
          COALESCE(v.captured_at, v.fecha_visita::timestamptz) AS fecha_visita,
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
        COALESCE(s.nombre, t.sector) AS sector,
        t.sector_id,
        s.color AS sector_color,
        COALESCE((
          SELECT STRING_AGG(seller.name, ', ' ORDER BY seller.name)
          FROM vendedor_sectores assignment
          JOIN users seller ON seller.id = assignment.vendedor_id AND seller.is_active = TRUE
          WHERE assignment.sector_id = t.sector_id
        ), '') AS sector_vendedores,
        t.vendedor_asignado_id,
        assigned_user.name AS vendedor_asignado_nombre,
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
      LEFT JOIN users assigned_user ON assigned_user.id = t.vendedor_asignado_id
      LEFT JOIN sectores s ON s.id = t.sector_id
      WHERE ($1::boolean = TRUE OR t.is_active = TRUE)
        AND (
          ($2::boolean = TRUE AND t.tipo IN ('MATRIZ', 'LOCAL', 'ALMACEN'))
          OR ($2::boolean = FALSE AND t.tipo = 'TALLER')
        )
        AND ($3::text <> 'VENDEDOR' OR (t.sector_id IS NULL AND t.vendedor_asignado_id = $4) OR EXISTS (
          SELECT 1 FROM vendedor_sectores own
          JOIN sectores own_sector ON own_sector.id = own.sector_id AND own_sector.is_active = TRUE
          WHERE own.sector_id = t.sector_id AND own.vendedor_id = $4
        ))
      ORDER BY t.nombre ASC
    `, [includeDeleted, isCompanyPointRequest, req.user.role, req.user.id]);
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
      `SELECT t.id, t.nombre, t.latitud, t.longitud, t.propietario, t.telefono, t.direccion, t.correo,
              t.observaciones, COALESCE(s.nombre, t.sector) AS sector, t.sector_id, s.color AS sector_color,
              COALESCE((SELECT STRING_AGG(seller.name, ', ' ORDER BY seller.name)
                        FROM vendedor_sectores assignment
                        JOIN users seller ON seller.id = assignment.vendedor_id AND seller.is_active = TRUE
                        WHERE assignment.sector_id = t.sector_id), '') AS sector_vendedores,
              t.vendedor_asignado_id,
              assigned_user.name AS vendedor_asignado_nombre,
              t.tipo, t.radio_geocerca_metros, t.is_active, t.deleted_at, t.created_at
       FROM talleres t
       LEFT JOIN users assigned_user ON assigned_user.id = t.vendedor_asignado_id
       LEFT JOIN sectores s ON s.id = t.sector_id
       WHERE t.id = $1 AND (t.is_active = TRUE OR $2 = 'ADMIN')
         AND ($2 <> 'VENDEDOR' OR (t.sector_id IS NULL AND t.vendedor_asignado_id = $3) OR EXISTS (
           SELECT 1 FROM vendedor_sectores own
           JOIN sectores own_sector ON own_sector.id = own.sector_id AND own_sector.is_active = TRUE
           WHERE own.sector_id = t.sector_id AND own.vendedor_id = $3
         ))`,
      [id, req.user.role, req.user.id]
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
  const { nombre, latitud, longitud, tipo, radio_geocerca_metros, sector_id } = req.body;
  const normalizedType = req.user.role === 'ADMIN' ? String(tipo || 'TALLER').toUpperCase() : 'TALLER';
  const geofenceRadius = req.user.role === 'ADMIN' ? Number(radio_geocerca_metros || 100) : 100;

  if (!isNonEmptyString(nombre) || !isValidLatitude(latitud) || !isValidLongitude(longitud)) {
    return res.status(400).json({ error: 'Ingrese un nombre y coordenadas GPS válidas.' });
  }
  if (!['TALLER', 'MATRIZ', 'LOCAL', 'ALMACEN'].includes(normalizedType)) {
    return res.status(400).json({ error: 'El tipo de punto no es válido.' });
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

    const assignedSellerId = req.user.role === 'VENDEDOR' ? req.user.id : null;
    // Sellers register workshops without classifying them. Sector assignment is an admin task.
    const resolvedSectorId = req.user.role === 'ADMIN' && sector_id ? Number(sector_id) : null;
    if (resolvedSectorId) {
      const sectorCheck = await db.query('SELECT id FROM sectores WHERE id = $1 AND is_active = TRUE', [resolvedSectorId]);
      if (sectorCheck.rows.length === 0) return res.status(400).json({ error: 'El sector seleccionado no está disponible.' });
    }
    const result = await transaction(async (client) => {
      if (normalizedType === 'TALLER') await validateWorkshopLocation(client, latitud, longitud);
      const duplicate = await client.query('SELECT id FROM talleres WHERE LOWER(nombre) = LOWER($1)', [nombre.trim()]);
      if (duplicate.rows.length) throw Object.assign(new Error('Ya existe un taller registrado con ese nombre.'), { status: 409 });
      return client.query(
      `INSERT INTO talleres
         (nombre, latitud, longitud, tipo, radio_geocerca_metros, sector_id, sector, vendedor_asignado_id)
       VALUES ($1, $2, $3, $4, $5, $6, (SELECT nombre FROM sectores WHERE id = $6), $7)
       RETURNING id, nombre, latitud, longitud, tipo, radio_geocerca_metros, sector, sector_id,
                 vendedor_asignado_id, created_at`,
      [nombre.trim(), latitud, longitud, normalizedType, geofenceRadius, resolvedSectorId, assignedSellerId]
      );
    });

    await safeLogActivity({
      req,
      action: 'TALLER_CREADO',
      entityType: 'taller',
      entityId: result.rows[0].id,
      details: {
        nombre: result.rows[0].nombre,
        tipo: result.rows[0].tipo,
        vendedor_asignado_id: result.rows[0].vendedor_asignado_id
      }
    });

    return res.status(201).json({ message: 'Punto registrado exitosamente.', taller: result.rows[0] });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    console.error('Error creating taller:', error);
    return res.status(500).json({ error: 'Error al registrar el punto.' });
  }
};

/**
 * Update an existing workshop
 */
const updateTaller = async (req, res) => {
  const { id } = req.params;
  const {
    nombre, latitud, longitud, propietario, telefono, direccion, correo, observaciones,
    tipo, radio_geocerca_metros, sector_id, vendedor_asignado_id
  } = req.body;
  const normalizedType = String(tipo || 'TALLER').toUpperCase();
  const geofenceRadius = Number(radio_geocerca_metros || 100);
  const normalizedSectorId = sector_id === '' || sector_id === null || sector_id === undefined ? null : Number(sector_id);
  const assignedSellerId = vendedor_asignado_id === '' || vendedor_asignado_id === null || vendedor_asignado_id === undefined
    ? null
    : Number(vendedor_asignado_id);

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
  if (assignedSellerId !== null && !Number.isInteger(assignedSellerId)) {
    return res.status(400).json({ error: 'Seleccione un vendedor válido.' });
  }
  if (normalizedSectorId !== null && (!Number.isInteger(normalizedSectorId) || normalizedSectorId <= 0)) {
    return res.status(400).json({ error: 'Seleccione un sector válido.' });
  }

  try {
    // Check if workshop exists
    const checkRes = await db.query('SELECT id FROM talleres WHERE id = $1 AND is_active = TRUE', [id]);
    if (checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Taller no encontrado.' });
    }

    if (normalizedSectorId !== null) {
      const sectorCheck = await db.query('SELECT id FROM sectores WHERE id = $1 AND is_active = TRUE', [normalizedSectorId]);
      if (sectorCheck.rows.length === 0) return res.status(400).json({ error: 'El sector seleccionado no está disponible.' });
    }

    if (assignedSellerId !== null) {
      const sellerCheck = await db.query(
        `SELECT id FROM users WHERE id = $1 AND role = 'VENDEDOR' AND is_active = TRUE`,
        [assignedSellerId]
      );
      if (sellerCheck.rows.length === 0) {
        return res.status(400).json({ error: 'El vendedor seleccionado no está disponible.' });
      }
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

    const result = await transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(74001)');
      const current = (await client.query('SELECT latitud, longitud, tipo FROM talleres WHERE id = $1 FOR UPDATE', [id])).rows[0];
      if (normalizedType === 'TALLER' && (current.tipo !== 'TALLER' || Number(current.latitud) !== Number(latitud) || Number(current.longitud) !== Number(longitud))) {
        await validateWorkshopLocation(client, latitud, longitud, id);
      }
      return client.query(
      `UPDATE talleres 
       SET nombre = $1, latitud = $2, longitud = $3, propietario = $4, telefono = $5,
           direccion = $6, correo = $7, observaciones = $8, tipo = $9, radio_geocerca_metros = $10,
           sector_id = $11, sector = (SELECT nombre FROM sectores WHERE id = $11), vendedor_asignado_id = $12
       WHERE id = $13
       RETURNING id, nombre, latitud, longitud, propietario, telefono, direccion, correo,
                 observaciones, tipo, radio_geocerca_metros, sector, sector_id, vendedor_asignado_id, created_at`,
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
        normalizedSectorId,
        assignedSellerId,
        id
      ]
      );
    });

    await safeLogActivity({
      req,
      action: 'TALLER_ACTUALIZADO',
      entityType: 'taller',
      entityId: result.rows[0].id,
      details: {
        nombre: result.rows[0].nombre,
        tipo: result.rows[0].tipo,
        radio_geocerca_metros: result.rows[0].radio_geocerca_metros,
        sector: result.rows[0].sector,
        vendedor_asignado_id: result.rows[0].vendedor_asignado_id
      }
    });

    return res.status(200).json({
      message: 'Taller actualizado exitosamente.',
      taller: result.rows[0]
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
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
      `SELECT t.id
       FROM talleres t
       WHERE t.id = $1 AND (t.is_active = TRUE OR $2 = 'ADMIN')
         AND ($2 <> 'VENDEDOR' OR (t.sector_id IS NULL AND t.vendedor_asignado_id = $3) OR EXISTS (
           SELECT 1 FROM vendedor_sectores own
           JOIN sectores own_sector ON own_sector.id = own.sector_id AND own_sector.is_active = TRUE
           WHERE own.sector_id = t.sector_id AND own.vendedor_id = $3
         ))`,
      [id, req.user.role, req.user.id]
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
        COALESCE(v.captured_at, v.fecha_visita::timestamptz) AS fecha_visita,
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
