-- Migration 002: trava monitored_url_id como obrigatória
-- Pré-requisito já confirmado: COUNT(*) com monitored_url_id IS NULL = 0
ALTER TABLE optsislog.site_availability
  ALTER COLUMN monitored_url_id SET NOT NULL;