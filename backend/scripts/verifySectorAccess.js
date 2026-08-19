const jwt = require('jsonwebtoken');
const db = require('../src/db');
require('dotenv').config();

const requestJson = async (path, user) => {
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '2m' });
  const response = await fetch(`http://localhost:${process.env.PORT || 5000}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`${path}: ${response.status} ${body.error || 'Error'}`);
  return body;
};

const run = async () => {
  try {
    const users = await db.query(
      `SELECT id, role FROM users
       WHERE is_active = TRUE AND role IN ('ADMIN', 'VENDEDOR')
       ORDER BY CASE WHEN role = 'ADMIN' THEN 0 ELSE 1 END, id`
    );
    const admin = users.rows.find((user) => user.role === 'ADMIN');
    const seller = users.rows.find((user) => user.role === 'VENDEDOR');
    if (!admin || !seller) throw new Error('Se requiere un administrador y un vendedor activos.');

    const [adminSectors, sellerSectors, sellerWorkshops, sellerMap] = await Promise.all([
      requestJson('/api/sectores', admin),
      requestJson('/api/sectores', seller),
      requestJson('/api/talleres', seller),
      requestJson('/api/mapa/talleres', seller)
    ]);
    const unassignedResult = await db.query(
      `SELECT u.id, u.role
       FROM users u
       WHERE u.role = 'VENDEDOR' AND u.is_active = TRUE
         AND NOT EXISTS (SELECT 1 FROM vendedor_sectores vs WHERE vs.vendedor_id = u.id)
       LIMIT 1`
    );
    const unassignedWorkshops = unassignedResult.rows[0]
      ? await requestJson('/api/talleres', unassignedResult.rows[0])
      : [];
    console.log(JSON.stringify({
      admin_sectors: adminSectors.length,
      seller_sectors: sellerSectors.length,
      seller_workshops: sellerWorkshops.length,
      seller_map_markers: sellerMap.length,
      unassigned_seller_workshops: unassignedWorkshops.length
    }));
  } finally {
    await db.pool.end();
  }
};

run().catch((error) => {
  console.error('Sector access verification failed:', error);
  process.exitCode = 1;
});
