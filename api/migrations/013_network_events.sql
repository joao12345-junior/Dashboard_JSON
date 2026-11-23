-- Migration 013: eventos de rede (UniFi) recebidos por syslog em formato CEF
-- Tabela generica de proposito: o coletor guarda o cabecalho CEF em colunas e
-- o restante (extension) em JSONB, mais a linha original em raw. Os nomes dos
-- campos que o UniFi realmente manda so ficam claros com dados reais; com
-- JSONB da pra especializar depois (colunas/indices/paginas) sem perder nada.
-- created_at = quando o coletor gravou (base da retencao); event_time = quando
-- o evento aconteceu, se o CEF trouxe (campo rt), senao NULL.
CREATE TABLE IF NOT EXISTS optsislog.network_events (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event_time TIMESTAMPTZ,
  source_ip TEXT,
  cef_version TEXT,
  device_vendor TEXT,
  device_product TEXT,
  device_version TEXT,
  signature_id TEXT,
  name TEXT,
  severity SMALLINT,
  extension JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_network_events_created_at
  ON optsislog.network_events (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_network_events_signature_id
  ON optsislog.network_events (signature_id);
