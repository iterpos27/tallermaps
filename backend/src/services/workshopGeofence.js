const { rejectRequest } = require('./transactions');
const MIN_WORKSHOP_DISTANCE_METERS = 5;

const distanceMeters = (lat1, lon1, lat2, lon2) => {
  const rad = (value) => Number(value) * Math.PI / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
};

// All workshop insertions and location changes use this lock in a transaction.
// Archived workshops also reserve their location: restore the original instead.
const validateWorkshopLocation = async (client, latitude, longitude, excludedId = null) => {
  await client.query('SELECT pg_advisory_xact_lock(74001)');
  const nearby = await client.query(
    `SELECT id, nombre, latitud, longitud, is_active FROM talleres
     WHERE tipo = 'TALLER' AND ($2::integer IS NULL OR id <> $2)
       AND latitud BETWEEN $1::double precision - 0.00046 AND $1::double precision + 0.00046`,
    [latitude, excludedId]
  );
  if (nearby.rows.some((point) => distanceMeters(latitude, longitude, point.latitud, point.longitud) <= MIN_WORKSHOP_DISTANCE_METERS + 1e-7)) {
    throw rejectRequest(409, 'Ya existe un taller a 5 metros o menos de esta ubicación. Seleccione el taller existente; si no aparece, solicite al administrador su asignación o restauración.');
  }
};

module.exports = { distanceMeters, validateWorkshopLocation, MIN_WORKSHOP_DISTANCE_METERS };
