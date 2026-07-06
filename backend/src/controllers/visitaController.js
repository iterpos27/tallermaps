const db = require('../db');
const { storageService } = require('../services/storage');

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
        v.fuera_rango,
        v.distancia_metros,
        t.id as taller_id,
        t.nombre as taller_nombre,
        u.id as vendedor_id,
        u.name as vendedor_nombre,
        u.email as vendedor_email
      FROM visitas v
      JOIN talleres t ON v.taller_id = t.id
      JOIN users u ON v.vendedor_id = u.id
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
        v.fuera_rango,
        v.distancia_metros,
        t.id as taller_id,
        t.nombre as taller_nombre,
        u.id as vendedor_id,
        u.name as vendedor_nombre,
        u.email as vendedor_email
      FROM visitas v
      JOIN talleres t ON v.taller_id = t.id
      JOIN users u ON v.vendedor_id = u.id
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
  const { taller_id, taller_nombre, latitud, longitud } = req.body;
  const file = req.file;

  // Validation
  if (!file) {
    return res.status(400).json({ error: 'La foto de la visita es requerida.' });
  }

  if (latitud === undefined || longitud === undefined) {
    // If upload fails in client, delete file to clean up
    if (file) await storageService.deleteFile(`/uploads/${file.filename}`);
    return res.status(400).json({ error: 'Las coordenadas GPS son requeridas.' });
  }

  try {
    let resolvedTallerId = null;

    if (taller_id) {
      // Check if workshop exists
      const tallerCheck = await db.query('SELECT id FROM talleres WHERE id = $1', [taller_id]);
      if (tallerCheck.rows.length === 0) {
        await storageService.deleteFile(`/uploads/${file.filename}`);
        return res.status(400).json({ error: 'El taller seleccionado no existe.' });
      }
      resolvedTallerId = taller_id;
    } else if (taller_nombre && taller_nombre.trim() !== '') {
      const trimmedName = taller_nombre.trim();
      // Check if a workshop with the same name already exists
      const nameCheck = await db.query('SELECT id FROM talleres WHERE LOWER(nombre) = LOWER($1)', [trimmedName]);
      
      if (nameCheck.rows.length > 0) {
        resolvedTallerId = nameCheck.rows[0].id;
      } else {
        // Create new workshop with coordinates
        const newTallerResult = await db.query(
          `INSERT INTO talleres (nombre, latitud, longitud) 
           VALUES ($1, $2, $3) 
           RETURNING id`,
          [trimmedName, latitud, longitud]
        );
        resolvedTallerId = newTallerResult.rows[0].id;
      }
    } else {
      await storageService.deleteFile(`/uploads/${file.filename}`);
      return res.status(400).json({ error: 'Debe proporcionar un ID de taller o un nombre de taller nuevo.' });
    }

    // Save image to storage service
    const foto_url = await storageService.saveFile(file, req);

    // Calculate geofencing distance if it's an existing workshop
    let fueraRango = false;
    let distanciaMetros = 0;

    if (taller_id) {
      const tallerCheck = await db.query('SELECT latitud, longitud FROM talleres WHERE id = $1', [taller_id]);
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
      `INSERT INTO visitas (taller_id, vendedor_id, foto_url, latitud, longitud, fuera_rango, distancia_metros) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING id, taller_id, vendedor_id, foto_url, latitud, longitud, fecha_visita, fuera_rango, distancia_metros`,
      [resolvedTallerId, vendedor_id, foto_url, latitud, longitud, fueraRango, distanciaMetros]
    );

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
    return res.status(500).json({ error: 'Error al registrar la visita en el servidor.' });
  }
};

module.exports = {
  getVisitas,
  getVisitaById,
  createVisita
};
