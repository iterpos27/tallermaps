ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS client_request_id VARCHAR(100);
ALTER TABLE visitas ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS visitas_request_unique ON visitas(vendedor_id, client_request_id)
  WHERE client_request_id IS NOT NULL;
ALTER TABLE entregas_recorridos ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT;
