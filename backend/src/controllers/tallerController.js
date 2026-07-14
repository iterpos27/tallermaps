const db = require('../db');

/**
 * List all workshops (talleres)
 */
const getTalleres = async (req, res) => {
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
        t.created_at,
        lv.fecha_visita AS ultima_fecha_visita,
        u.name AS ultimo_vendedor_nombre
      FROM talleres t
      LEFT JOIN latest_visitas lv ON lv.taller_id = t.id
      LEFT JOIN users u ON u.id = lv.vendedor_id
      ORDER BY t.nombre ASC
    `);
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
      'SELECT id, nombre, latitud, longitud, propietario, telefono, direccion, correo, observaciones, created_at FROM talleres WHERE id = $1',
      [id]
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
  const { nombre, latitud, longitud } = req.body;

  if (!nombre || latitud === undefined || longitud === undefined) {
    return res.status(400).json({ 
      error: 'El nombre, latitud y longitud son campos requeridos.' 
    });
  }

  try {
    // Check if workshop name already exists (case-insensitive)
    const existingResult = await db.query(
      'SELECT id FROM talleres WHERE LOWER(nombre) = LOWER($1)',
      [nombre.trim()]
    );

    if (existingResult.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Ya existe un taller registrado con ese nombre.' 
      });
    }

    const result = await db.query(
      `INSERT INTO talleres (nombre, latitud, longitud) 
       VALUES ($1, $2, $3) 
       RETURNING id, nombre, latitud, longitud, created_at`,
      [nombre.trim(), latitud, longitud]
    );

    return res.status(201).json({
      message: 'Taller registrado exitosamente.',
      taller: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating taller:', error);
    return res.status(500).json({ 
      error: 'Error al registrar el taller.' 
    });
  }
};

/**
 * Update an existing workshop
 */
const updateTaller = async (req, res) => {
  const { id } = req.params;
  const { nombre, latitud, longitud, propietario, telefono, direccion, correo, observaciones } = req.body;

  if (!nombre || latitud === undefined || longitud === undefined) {
    return res.status(400).json({ 
      error: 'El nombre, latitud y longitud son campos requeridos.' 
    });
  }

  try {
    // Check if workshop exists
    const checkRes = await db.query('SELECT id FROM talleres WHERE id = $1', [id]);
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
       SET nombre = $1, latitud = $2, longitud = $3, propietario = $4, telefono = $5, direccion = $6, correo = $7, observaciones = $8
       WHERE id = $9 
       RETURNING id, nombre, latitud, longitud, propietario, telefono, direccion, correo, observaciones, created_at`,
      [
        nombre.trim(), 
        latitud, 
        longitud, 
        propietario ? propietario.trim() : null, 
        telefono ? telefono.trim() : null, 
        direccion ? direccion.trim() : null, 
        correo ? correo.trim() : null, 
        observaciones ? observaciones.trim() : null, 
        id
      ]
    );

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
 * Get visit history for a specific workshop
 */
const getTallerVisitas = async (req, res) => {
  const { id } = req.params;

  try {
    // Check if workshop exists
    const checkRes = await db.query('SELECT id FROM talleres WHERE id = $1', [id]);
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
  getTallerVisitas
};
