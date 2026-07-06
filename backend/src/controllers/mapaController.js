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
        lv.foto_url,
        lv.fecha_visita,
        u.name as vendedor_nombre
      FROM talleres t
      LEFT JOIN latest_visitas lv ON t.id = lv.taller_id
      LEFT JOIN users u ON lv.vendedor_id = u.id
      ORDER BY t.nombre ASC;
    `;

    const result = await db.query(queryText);
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
