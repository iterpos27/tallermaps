ALTER TABLE visitas ADD COLUMN IF NOT EXISTS resultado TEXT NOT NULL DEFAULT 'SIN_REGISTRO'
  CHECK (resultado IN ('SIN_REGISTRO','INTERESADO','SEGUIMIENTO','VENTA','NO_INTERESADO'));
ALTER TABLE talleres ADD COLUMN IF NOT EXISTS merged_into_id INTEGER REFERENCES talleres(id) ON DELETE RESTRICT;
CREATE TABLE IF NOT EXISTS compromisos (
  id SERIAL PRIMARY KEY,
  taller_id INTEGER NOT NULL REFERENCES talleres(id) ON DELETE RESTRICT,
  visita_id INTEGER REFERENCES visitas(id) ON DELETE SET NULL,
  vendedor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  descripcion TEXT NOT NULL CHECK (length(btrim(descripcion)) BETWEEN 10 AND 2000),
  fecha DATE NOT NULL,
  estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE','COMPLETADO','CANCELADO')),
  cierre TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_compromisos_responsable ON compromisos(vendedor_id, estado, fecha);
CREATE INDEX IF NOT EXISTS idx_compromisos_taller ON compromisos(taller_id);
CREATE INDEX IF NOT EXISTS idx_compromisos_visita ON compromisos(visita_id);
CREATE TABLE IF NOT EXISTS revisiones_duplicados (
  taller_a INTEGER NOT NULL REFERENCES talleres(id) ON DELETE CASCADE,
  taller_b INTEGER NOT NULL REFERENCES talleres(id) ON DELETE CASCADE,
  motivo TEXT NOT NULL,
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(taller_a,taller_b), CHECK(taller_a < taller_b)
);
CREATE OR REPLACE FUNCTION audit_business_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor INTEGER;
BEGIN
  actor := NULLIF(current_setting('app.actor_id', true), '')::integer;
  INSERT INTO activity_logs(user_id,action,entity_type,entity_id,details)
  VALUES(actor, TG_TABLE_NAME || '_' || TG_OP, TG_TABLE_NAME, OLD.id::text,
    jsonb_build_object('antes',to_jsonb(OLD),'despues', CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW) END));
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
DROP TRIGGER IF EXISTS audit_business ON talleres;
CREATE TRIGGER audit_business AFTER UPDATE OR DELETE ON talleres FOR EACH ROW EXECUTE FUNCTION audit_business_change();
DROP TRIGGER IF EXISTS audit_business ON visitas;
CREATE TRIGGER audit_business AFTER UPDATE OR DELETE ON visitas FOR EACH ROW EXECUTE FUNCTION audit_business_change();
DROP TRIGGER IF EXISTS audit_business ON compromisos;
CREATE TRIGGER audit_business AFTER UPDATE OR DELETE ON compromisos FOR EACH ROW EXECUTE FUNCTION audit_business_change();
