ALTER TABLE talleres ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE talleres ALTER COLUMN created_at SET DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'America/Guayaquil');
UPDATE talleres t SET created_by = a.user_id
FROM (SELECT DISTINCT ON (entity_id) entity_id, user_id FROM activity_logs
      WHERE action = 'TALLER_CREADO' AND entity_type = 'taller'
      ORDER BY entity_id, created_at, id) a
WHERE t.id::text = a.entity_id AND t.created_by IS NULL;
CREATE INDEX IF NOT EXISTS idx_talleres_report_created ON talleres(created_at) WHERE tipo = 'TALLER';
CREATE INDEX IF NOT EXISTS idx_visitas_report_fecha ON visitas(fecha_visita);
