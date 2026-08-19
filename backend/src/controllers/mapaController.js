const db = require('../db');

/**
 * Get all workshops (talleres) with their latest visit information for the map
 */
const getTalleresMapa = async (req, res) => {
  try {
    const queryText = `
      WITH latest_visitas AS (
        SELECT DISTINCT ON (taller_id)
          taller_id,
          foto_url,
          fecha_visita,
          vendedor_id
        FROM visitas
        ORDER BY taller_id, fecha_visita DESC
      )
      SELECT 
        t.id,
        t.nombre,
        t.latitud,
        t.longitud,
        t.created_at,
        COALESCE(s.nombre, t.sector) AS sector,
        t.sector_id,
        s.color AS sector_color,
        t.vendedor_asignado_id,
        assigned_user.name AS vendedor_asignado_nombre,
        t.tipo,
        t.radio_geocerca_metros,
        lv.foto_url,
        lv.fecha_visita,
        u.name as vendedor_nombre
      FROM talleres t
      LEFT JOIN latest_visitas lv ON t.id = lv.taller_id
      LEFT JOIN users u ON lv.vendedor_id = u.id
      LEFT JOIN users assigned_user ON assigned_user.id = t.vendedor_asignado_id
      LEFT JOIN sectores s ON s.id = t.sector_id
      WHERE t.is_active = TRUE AND t.tipo = 'TALLER'
        AND ($1::text <> 'VENDEDOR' OR EXISTS (
          SELECT 1 FROM vendedor_sectores own
          JOIN sectores own_sector ON own_sector.id = own.sector_id AND own_sector.is_active = TRUE
          WHERE own.sector_id = t.sector_id AND own.vendedor_id = $2
        ))
      ORDER BY t.nombre ASC;
    `;

    const result = await db.query(queryText, [req.user.role, req.user.id]);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching map workshops data:', error);
    return res.status(500).json({ 
      error: 'Error al obtener los datos del mapa.' 
    });
  }
};

module.exports = {
  getTalleresMapa
};
