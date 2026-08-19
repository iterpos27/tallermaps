const db = require('../db');
const {
  isValidLatitude,
  isValidLongitude,
  isValidObservation,
  MIN_OBSERVATION_LENGTH
} = require('../utils/validation');
const { storageService } = require('../services/storage');
const { logActivity } = require('../services/audit');
const { resolveSellerSectorId, sellerCanAccessWorkshop } = require('../services/sectorAccess');

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
        v.fecha_visita,
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
      queryText += ` AND v.fecha_visita >= $${paramIndex}`;
      queryParams.push(new Date(fecha_inicio + 'T00:00:00'));
      paramIndex++;
    }
    if (fecha_fin) {
      queryText += ` AND v.fecha_visita <= $${paramIndex}`;
      queryParams.push(new Date(fecha_fin + 'T23:59:59'));
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
        v.fecha_visita,
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
      SET fecha_visita = $1
      WHERE id = $2
    `;

    if (req.user.role === 'VENDEDOR') {
      queryText += ' AND vendedor_id = $3';
      params.push(req.user.id);
    }

    queryText += ' RETURNING id, taller_id, vendedor_id, fecha_visita, fuera_rango';
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

function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = parseFloat(lat1) * Math.PI / 180;
  const phi2 = parseFloat(lat2) * Math.PI / 180;
  const deltaPhi = (parseFloat(lat2) - parseFloat(lat1)) * Math.PI / 180;
  const deltaLambda = (parseFloat(lon2) - parseFloat(lon1)) * Math.PI / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

/**
 * Create a new visit
 */
const createVisita = async (req, res) => {
  const vendedor_id = req.user.id;
  const { taller_id, taller_nombre, latitud, longitud, observacion, programacion_id, sector_id } = req.body;
  const file = req.file;

  // Validation
  if (!file) {
    return res.status(400).json({ error: 'La foto de la visita es requerida.' });
  }

  if (!isValidObservation(observacion)) {
    await storageService.deleteFile(`/uploads/${file.filename}`);
    return res.status(400).json({
      error: `Las observaciones son obligatorias y deben tener al menos ${MIN_OBSERVATION_LENGTH} caracteres.`
    });
  }

  if (!isValidLatitude(latitud) || !isValidLongitude(longitud)) {
    // If upload fails in client, delete file to clean up
    if (file) await storageService.deleteFile(`/uploads/${file.filename}`);
    return res.status(400).json({ error: 'Las coordenadas GPS no son válidas.' });
  }

  try {
    let resolvedTallerId = null;
    let resolvedProgramacionId = programacion_id || null;

    if (taller_id) {
      // Check if workshop exists
      const tallerCheck = await db.query(
        `SELECT t.id
         FROM talleres t
         JOIN vendedor_sectores vs ON vs.sector_id = t.sector_id
         JOIN sectores s ON s.id = vs.sector_id AND s.is_active = TRUE
         WHERE t.id = $1 AND t.is_active = TRUE AND vs.vendedor_id = $2`,
        [taller_id, vendedor_id]
      );
      if (tallerCheck.rows.length === 0) {
        await storageService.deleteFile(`/uploads/${file.filename}`);
        return res.status(403).json({ error: 'El taller no pertenece a uno de sus sectores.' });
      }
      resolvedTallerId = taller_id;
    } else if (taller_nombre && taller_nombre.trim() !== '') {
      const trimmedName = taller_nombre.trim();
      // Check if a workshop with the same name already exists
      const nameCheck = await db.query('SELECT id FROM talleres WHERE LOWER(nombre) = LOWER($1)', [trimmedName]);
      
      if (nameCheck.rows.length > 0) {
        resolvedTallerId = nameCheck.rows[0].id;
        if (!await sellerCanAccessWorkshop(db, vendedor_id, resolvedTallerId)) {
          await storageService.deleteFile(`/uploads/${file.filename}`);
          return res.status(403).json({ error: 'Ya existe un taller con ese nombre fuera de sus sectores.' });
        }
      } else {
        // Create new workshop with coordinates
        const resolvedSectorId = await resolveSellerSectorId(db, vendedor_id, sector_id, { latitude: latitud, longitude: longitud });
        const newTallerResult = await db.query(
          `INSERT INTO talleres (nombre, latitud, longitud, vendedor_asignado_id, sector_id, sector)
           VALUES ($1, $2, $3, $4, $5, (SELECT nombre FROM sectores WHERE id = $5))
           RETURNING id`,
          [trimmedName, latitud, longitud, vendedor_id, resolvedSectorId]
        );
        resolvedTallerId = newTallerResult.rows[0].id;
      }
    } else {
      await storageService.deleteFile(`/uploads/${file.filename}`);
      return res.status(400).json({ error: 'Debe proporcionar un ID de taller o un nombre de taller nuevo.' });
    }

    if (resolvedProgramacionId) {
      const programacionCheck = await db.query(
        `SELECT id, taller_id, vendedor_id, estado
         FROM programaciones_visita
         WHERE id = $1`,
        [resolvedProgramacionId]
      );

      if (programacionCheck.rows.length === 0) {
        await storageService.deleteFile(`/uploads/${file.filename}`);
        return res.status(400).json({ error: 'La programacion seleccionada no existe.' });
      }

      const programacion = programacionCheck.rows[0];
      if (Number(programacion.vendedor_id) !== Number(vendedor_id)) {
        await storageService.deleteFile(`/uploads/${file.filename}`);
        return res.status(403).json({ error: 'La programacion seleccionada pertenece a otro vendedor.' });
      }

      if (Number(programacion.taller_id) !== Number(resolvedTallerId)) {
        await storageService.deleteFile(`/uploads/${file.filename}`);
        return res.status(400).json({ error: 'La programacion seleccionada no corresponde al taller elegido.' });
      }

      if (programacion.estado === 'CANCELADA') {
        await storageService.deleteFile(`/uploads/${file.filename}`);
        return res.status(400).json({ error: 'La programacion seleccionada esta cancelada.' });
      }
    } else {
      const today = new Date().toISOString().split('T')[0];
      const autoMatch = await db.query(
        `SELECT id
         FROM programaciones_visita
         WHERE taller_id = $1
           AND vendedor_id = $2
           AND fecha_programada = $3
           AND estado = 'PENDIENTE'
         ORDER BY created_at ASC
         LIMIT 1`,
        [resolvedTallerId, vendedor_id, today]
      );
      if (autoMatch.rows.length > 0) {
        resolvedProgramacionId = autoMatch.rows[0].id;
      }
    }

    // Save image to storage service
    const foto_url = await storageService.saveFile(file, req);

    // Calculate geofencing distance if it's an existing workshop
    let fueraRango = false;
    let distanciaMetros = 0;

    if (taller_id) {
      const tallerCheck = await db.query('SELECT latitud, longitud FROM talleres WHERE id = $1 AND is_active = TRUE', [taller_id]);
      if (tallerCheck.rows.length > 0 && tallerCheck.rows[0].latitud && tallerCheck.rows[0].longitud) {
        const tLat = parseFloat(tallerCheck.rows[0].latitud);
        const tLng = parseFloat(tallerCheck.rows[0].longitud);
        const vLat = parseFloat(latitud);
        const vLng = parseFloat(longitud);
        
        if (!isNaN(tLat) && !isNaN(tLng) && !isNaN(vLat) && !isNaN(vLng)) {
          distanciaMetros = getDistanceInMeters(tLat, tLng, vLat, vLng);
          if (distanciaMetros > 100) {
            fueraRango = true;
          }
        }
      }
    }

    // Insert visit
    const result = await db.query(
      `INSERT INTO visitas (taller_id, vendedor_id, programacion_id, foto_url, latitud, longitud, observacion, fuera_rango, distancia_metros) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING id, taller_id, vendedor_id, programacion_id, foto_url, latitud, longitud, observacion, fecha_visita, fuera_rango, distancia_metros`,
      [
        resolvedTallerId,
        vendedor_id,
        resolvedProgramacionId,
        foto_url,
        latitud,
        longitud,
        observacion.trim(),
        fueraRango,
        distanciaMetros
      ]
    );

    if (resolvedProgramacionId) {
      await db.query(
        `UPDATE programaciones_visita
         SET estado = 'EJECUTADA', visita_id = $1, finalizada_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [result.rows[0].id, resolvedProgramacionId]
      );
    }

    return res.status(201).json({
      message: 'Visita registrada exitosamente.',
      visita: result.rows[0]
    });

  } catch (error) {
    console.error('Error creating visit:', error);
    // Cleanup photo in case of DB insert error
    if (file) {
      try {
        await storageService.deleteFile(`/uploads/${file.filename}`);
      } catch (err) {
        console.error('Failed to cleanup file:', err);
      }
    }
    if (error.message.includes('sector')) return res.status(403).json({ error: error.message });
    return res.status(500).json({ error: 'Error al registrar la visita en el servidor.' });
  }
};

/**
 * Permanently delete a visit. The route restricts this operation to ADMIN users.
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
       WHERE visita_id = $1 OR id = $2`,
      [id, visita.programacion_id]
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
