const db = require('../db');

const getActivity = async (req, res) => {
  const requestedPage = Number.parseInt(req.query.page || '1', 10);
  const requestedLimit = Number.parseInt(req.query.limit || '25', 10);
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(10, requestedLimit)) : 25;
  const offset = (page - 1) * limit;

  try {
    const [items, count] = await Promise.all([
      db.query(
        `SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.ip_address, a.created_at,
                u.name AS user_name, u.username
         FROM activity_logs a
         LEFT JOIN users u ON u.id = a.user_id
         ORDER BY a.created_at DESC
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      db.query('SELECT COUNT(*)::integer AS total FROM activity_logs')
    ]);

    return res.status(200).json({ items: items.rows, total: count.rows[0].total, page, limit });
  } catch (error) {
    console.error('Error fetching activity log:', error);
    return res.status(500).json({ error: 'Error al obtener la actividad administrativa.' });
  }
};

module.exports = { getActivity };
