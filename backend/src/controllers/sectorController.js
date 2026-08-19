const db = require('../db');
const { isNonEmptyString } = require('../utils/validation');
const { safeLogActivity } = require('../services/audit');
const { pointInPolygon, polygonsOverlap } = require('../utils/geojson');

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

const normalizePolygon = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const polygon = typeof value === 'string' ? JSON.parse(value) : value;
  if (!polygon || polygon.type !== 'Polygon' || !Array.isArray(polygon.coordinates) || polygon.coordinates.length === 0) {
    throw new Error('El polígono debe ser un GeoJSON de tipo Polygon.');
  }
  return polygon;
};

const assertNoOverlap = async (queryable, polygon, excludedId = null) => {
  if (!polygon) return;
  const result = await queryable.query(
    `SELECT id, nombre, poligono_geojson
     FROM sectores
     WHERE is_active = TRUE
       AND poligono_geojson IS NOT NULL
       AND ($1::integer IS NULL OR id <> $1)`,
    [excludedId]
  );
  const conflict = result.rows.find((sector) => polygonsOverlap(polygon, sector.poligono_geojson));
  if (conflict) {
    const error = new Error(`El área se cruza con el sector “${conflict.nombre}”. Ajuste los puntos antes de guardar.`);
    error.status = 409;
    throw error;
  }
};

const reassignWorkshopsByLocation = async (queryable) => {
  const [sectorsResult, workshopsResult, fallbackResult] = await Promise.all([
    queryable.query(
      `SELECT id, poligono_geojson
       FROM sectores
       WHERE is_active = TRUE AND poligono_geojson IS NOT NULL
       ORDER BY id ASC`
    ),
    queryable.query(
      `SELECT id, longitud, latitud
       FROM talleres
       WHERE is_active = TRUE AND tipo = 'TALLER'`
    ),
    queryable.query(
      `SELECT id FROM sectores
       WHERE LOWER(nombre) = LOWER('Por clasificar')
       LIMIT 1`
    )
  ]);
  const fallbackId = fallbackResult.rows[0]?.id || null;
  let updated = 0;

  for (const workshop of workshopsResult.rows) {
    const matchingSector = sectorsResult.rows.find((sector) => pointInPolygon(
      Number(workshop.longitud),
      Number(workshop.latitud),
      sector.poligono_geojson
    ));
    const sectorId = matchingSector?.id || fallbackId;
    const result = await queryable.query(
      `UPDATE talleres
       SET sector_id = $1,
           sector = (SELECT nombre FROM sectores WHERE id = $1)
       WHERE id = $2 AND sector_id IS DISTINCT FROM $1`,
      [sectorId, workshop.id]
    );
    updated += result.rowCount;
  }

  return updated;
};

const getSectores = async (req, res) => {
  const isAdmin = req.user.role === 'ADMIN';
  try {
    const result = await db.query(
      `SELECT
         s.id, s.nombre, s.color, s.poligono_geojson, s.is_active, s.created_at, s.updated_at,
         COUNT(DISTINCT t.id)::integer AS talleres_count,
         COUNT(DISTINCT vs.vendedor_id)::integer AS vendedores_count
       FROM sectores s
       LEFT JOIN talleres t ON t.sector_id = s.id AND t.is_active = TRUE AND t.tipo = 'TALLER'
       LEFT JOIN vendedor_sectores vs ON vs.sector_id = s.id
       WHERE ($1::boolean = TRUE OR s.is_active = TRUE)
         AND ($1::boolean = TRUE OR EXISTS (
           SELECT 1 FROM vendedor_sectores own
           WHERE own.sector_id = s.id AND own.vendedor_id = $2
         ))
       GROUP BY s.id
       ORDER BY s.nombre ASC`,
      [isAdmin, req.user.id]
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error fetching sectors:', error);
    return res.status(500).json({ error: 'Error al obtener los sectores.' });
  }
};

const createSector = async (req, res) => {
  const { nombre, color = '#1d5596', poligono_geojson } = req.body;
  if (!isNonEmptyString(nombre) || nombre.trim().length > 100) {
    return res.status(400).json({ error: 'Ingrese un nombre de sector de hasta 100 caracteres.' });
  }
  if (!COLOR_PATTERN.test(color)) {
    return res.status(400).json({ error: 'Seleccione un color hexadecimal válido.' });
  }

  const client = await db.pool.connect();
  try {
    const polygon = normalizePolygon(poligono_geojson);
    await client.query('BEGIN');
    await assertNoOverlap(client, polygon);
    const result = await client.query(
      `INSERT INTO sectores (nombre, color, poligono_geojson)
       VALUES ($1, $2, $3)
       RETURNING id, nombre, color, poligono_geojson, is_active, created_at, updated_at`,
      [nombre.trim(), color.toLowerCase(), polygon]
    );
    const reassignedWorkshops = await reassignWorkshopsByLocation(client);
    await client.query('COMMIT');
    await safeLogActivity({
      req,
      action: 'SECTOR_CREADO',
      entityType: 'sector',
      entityId: result.rows[0].id,
      details: { nombre: result.rows[0].nombre, talleres_reasignados: reassignedWorkshops }
    });
    return res.status(201).json({
      message: 'Sector creado exitosamente.',
      sector: result.rows[0],
      talleres_reasignados: reassignedWorkshops
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un sector con ese nombre.' });
    if (error.status === 409) return res.status(409).json({ error: error.message });
    if (error instanceof SyntaxError || error.message.includes('GeoJSON')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error creating sector:', error);
    return res.status(500).json({ error: 'Error al crear el sector.' });
  } finally {
    client.release();
  }
};

const updateSector = async (req, res) => {
  const { id } = req.params;
  const { nombre, color, poligono_geojson, is_active } = req.body;
  if (!/^\d+$/.test(id) || !isNonEmptyString(nombre) || nombre.trim().length > 100 || !COLOR_PATTERN.test(color)) {
    return res.status(400).json({ error: 'Revise el nombre y color del sector.' });
  }

  const client = await db.pool.connect();
  try {
    const polygon = normalizePolygon(poligono_geojson);
    await client.query('BEGIN');
    const currentResult = await client.query('SELECT is_active FROM sectores WHERE id = $1 FOR UPDATE', [id]);
    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sector no encontrado.' });
    }
    const nextIsActive = is_active ?? currentResult.rows[0].is_active;
    if (nextIsActive) await assertNoOverlap(client, polygon, Number(id));
    const result = await client.query(
      `UPDATE sectores
       SET nombre = $1, color = $2, poligono_geojson = $3,
           is_active = COALESCE($4, is_active), updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, nombre, color, poligono_geojson, is_active, created_at, updated_at`,
      [nombre.trim(), color.toLowerCase(), polygon, is_active, id]
    );
    const reassignedWorkshops = await reassignWorkshopsByLocation(client);
    await client.query('COMMIT');
    await safeLogActivity({
      req,
      action: 'SECTOR_ACTUALIZADO',
      entityType: 'sector',
      entityId: id,
      details: {
        nombre: result.rows[0].nombre,
        is_active: result.rows[0].is_active,
        talleres_reasignados: reassignedWorkshops
      }
    });
    return res.status(200).json({
      message: 'Sector actualizado exitosamente.',
      sector: result.rows[0],
      talleres_reasignados: reassignedWorkshops
    });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (error.code === '23505') return res.status(409).json({ error: 'Ya existe un sector con ese nombre.' });
    if (error.status === 409) return res.status(409).json({ error: error.message });
    if (error instanceof SyntaxError || error.message.includes('GeoJSON')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error updating sector:', error);
    return res.status(500).json({ error: 'Error al actualizar el sector.' });
  } finally {
    client.release();
  }
};

module.exports = { getSectores, createSector, updateSector };
