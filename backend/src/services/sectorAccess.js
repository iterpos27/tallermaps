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
     WHERE t.id = $1
       AND t.is_active = TRUE AND t.tipo = 'TALLER'
       AND ((t.sector_id IS NULL AND t.vendedor_asignado_id = $2) OR EXISTS (
         SELECT 1 FROM vendedor_sectores vs JOIN sectores s ON s.id = vs.sector_id AND s.is_active = TRUE
         WHERE vs.sector_id = t.sector_id AND vs.vendedor_id = $2
       ))
     LIMIT 1 FOR SHARE OF t`,
    [workshopId, sellerId]
  );
  return result.rows.length > 0;
};

module.exports = {
  normalizeSectorIds,
  getSellerSectorIds,
  sellerCanAccessWorkshop
};
