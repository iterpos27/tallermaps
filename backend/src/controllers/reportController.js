const db = require('../db');

module.exports = async (req, res) => {
  const { fecha_inicio, fecha_fin, vendedor_id } = req.query;
  if (!fecha_inicio || !fecha_fin) return res.status(400).json({ error: 'Seleccione fecha inicial y final.' });
  try {
    const params = [fecha_inicio, fecha_fin];
    if (vendedor_id) params.push(vendedor_id);
    const result = await db.query(`
      SELECT 'VISITA' AS tipo, v.id, t.id AS taller_id, t.nombre AS taller,
             to_char(v.fecha_visita, 'YYYY-MM-DD HH24:MI:SS') AS fecha,
             v.observacion AS observaciones, u.name AS responsable, u.id AS responsable_id, v.resultado,
             (SELECT string_agg(to_char(c.fecha,'YYYY-MM-DD') || ': ' || c.descripcion || ' (' || c.estado || ')', E'\n' ORDER BY c.fecha) FROM compromisos c WHERE c.visita_id=v.id) AS compromisos
      FROM visitas v JOIN talleres t ON t.id = v.taller_id LEFT JOIN users u ON u.id = v.vendedor_id
      WHERE v.fecha_visita >= $1::date AND v.fecha_visita < $2::date + INTERVAL '1 day'
      ${vendedor_id ? 'AND v.vendedor_id = $3' : ''}
      UNION ALL
      SELECT 'CREACION', t.id, t.id, t.nombre, to_char(t.created_at, 'YYYY-MM-DD HH24:MI:SS'),
             t.observaciones, u.name, u.id, NULL, NULL
      FROM talleres t LEFT JOIN users u ON u.id = t.created_by
      WHERE t.tipo = 'TALLER' AND t.created_at >= $1::date AND t.created_at < $2::date + INTERVAL '1 day'
      ${vendedor_id ? 'AND t.created_by = $3' : ''}
      ORDER BY fecha DESC, tipo, id DESC
    `, params);
    return res.json(result.rows);
  } catch (error) {
    console.error('Error generating report:', error);
    return res.status(500).json({ error: 'No se pudo generar el reporte.' });
  }
};
