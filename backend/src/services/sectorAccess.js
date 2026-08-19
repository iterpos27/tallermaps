const { pointInPolygon } = require('../utils/geojson');

const normalizeSectorIds = (value) => {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(Number).filter(Number.isInteger).filter((id) => id > 0))];
};

const getSellerSectorIds = async (queryable, sellerId) => {
  const result = await queryable.query(
    `SELECT sector_id
     FROM vendedor_sectores vs
     JOIN sectores s ON s.id = vs.sector_id AND s.is_active = TRUE
     WHERE vs.vendedor_id = $1`,
    [sellerId]
  );
  return result.rows.map((row) => Number(row.sector_id));
};

const sellerCanAccessWorkshop = async (queryable, sellerId, workshopId) => {
  const result = await queryable.query(
    `SELECT 1
     FROM talleres t
     JOIN vendedor_sectores vs ON vs.sector_id = t.sector_id
     JOIN sectores s ON s.id = vs.sector_id AND s.is_active = TRUE
     WHERE t.id = $1
       AND vs.vendedor_id = $2
       AND t.is_active = TRUE
     LIMIT 1`,
    [workshopId, sellerId]
  );
  return result.rows.length > 0;
};

const resolveSellerSectorId = async (queryable, sellerId, requestedSectorId, coordinates) => {
  const sectorIds = await getSellerSectorIds(queryable, sellerId);
  if (sectorIds.length === 0) {
    throw new Error('El vendedor no tiene sectores asignados. Solicite la asignación a un administrador.');
  }

  if (requestedSectorId !== undefined && requestedSectorId !== null && requestedSectorId !== '') {
    const normalizedId = Number(requestedSectorId);
    if (!sectorIds.includes(normalizedId)) {
      throw new Error('El sector seleccionado no está asignado al vendedor.');
    }
    return normalizedId;
  }

  if (sectorIds.length === 1) return sectorIds[0];

  if (coordinates && Number.isFinite(Number(coordinates.latitude)) && Number.isFinite(Number(coordinates.longitude))) {
    const sectors = await queryable.query(
      `SELECT id, poligono_geojson
       FROM sectores
       WHERE id = ANY($1::int[]) AND is_active = TRUE AND poligono_geojson IS NOT NULL`,
      [sectorIds]
    );
    const matches = sectors.rows.filter((sector) => pointInPolygon(
      Number(coordinates.longitude),
      Number(coordinates.latitude),
      sector.poligono_geojson
    ));
    if (matches.length === 1) return Number(matches[0].id);
  }

  throw new Error('Seleccione uno de sus sectores para registrar el taller.');
};

module.exports = {
  normalizeSectorIds,
  getSellerSectorIds,
  sellerCanAccessWorkshop,
  resolveSellerSectorId
};
