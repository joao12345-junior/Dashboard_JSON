-- Migration 015: links de internet (WAN) do gateway UniFi e historico de conexoes dos clientes.
--   network_wan:             ultimo estado de cada WAN (WAN, WAN2...) do gateway. O poller
--                            substitui a tabela inteira a cada ciclo em que consegue ler a WAN.
--   network_client_sessions: uma linha por "periodo conectado" de cada cliente
--                            (disconnected_at NULL = ainda conectado). Guarda 30 dias.
CREATE TABLE IF NOT EXISTS optsislog.network_wan (
  wan_group TEXT PRIMARY KEY,           -- "WAN", "WAN2"... (como o UniFi chama)
  name TEXT,                            -- nome dado no UniFi (ex.: "Unifique")
  isp_name TEXT,                        -- provedor detectado pelo UniFi
  ip_address TEXT,
  is_up BOOLEAN,
  is_enabled BOOLEAN,
  failover_only BOOLEAN,
  availability_pct REAL,                -- disponibilidade nas ultimas 24 h (UniFi)
  latency_ms REAL,
  rx_bps BIGINT,
  tx_bps BIGINT,
  gateway_mac TEXT,
  last_polled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS optsislog.network_client_sessions (
  id BIGSERIAL PRIMARY KEY,
  mac TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL,
  disconnected_at TIMESTAMPTZ,
  uplink_mac TEXT,
  ip_address TEXT
);

CREATE INDEX IF NOT EXISTS idx_network_client_sessions_mac
  ON optsislog.network_client_sessions (mac, connected_at DESC);

-- No maximo UMA sessao aberta por cliente.
CREATE UNIQUE INDEX IF NOT EXISTS uq_network_client_sessions_open
  ON optsislog.network_client_sessions (mac) WHERE disconnected_at IS NULL;
