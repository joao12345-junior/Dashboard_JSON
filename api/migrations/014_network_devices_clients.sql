-- Migration 014: estado atual da rede UniFi (dispositivos e clientes), via API local do UCG.
-- Diferente de network_events (historico de eventos por syslog), aqui cada linha e
-- o ULTIMO estado conhecido; o poller atualiza a cada ciclo (padrao 60 s).
--   network_devices: adotados no UniFi (UCG, APs, switches). Quem some da API e removido.
--   network_clients: quem ja se conectou. connected=false + disconnected_at quando some
--                    do ciclo; linhas sem atividade ha mais de 30 dias sao apagadas.
CREATE TABLE IF NOT EXISTS optsislog.network_devices (
  mac TEXT PRIMARY KEY,
  unifi_id TEXT,
  name TEXT,
  model TEXT,
  ip_address TEXT,
  state TEXT,
  firmware_version TEXT,
  firmware_updatable BOOLEAN,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  uptime_sec BIGINT,
  cpu_pct REAL,
  memory_pct REAL,
  uplink_tx_bps BIGINT,
  uplink_rx_bps BIGINT,
  last_heartbeat_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_polled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS optsislog.network_clients (
  mac TEXT PRIMARY KEY,
  name TEXT,
  hostname TEXT,
  note TEXT,
  ip_address TEXT,
  vendor TEXT,
  is_wired BOOLEAN NOT NULL DEFAULT false,
  is_guest BOOLEAN NOT NULL DEFAULT false,
  network_name TEXT,
  uplink_mac TEXT,
  ssid TEXT,
  signal_dbm SMALLINT,
  tx_bytes BIGINT,
  rx_bytes BIGINT,
  connected BOOLEAN NOT NULL DEFAULT true,
  connected_since TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_network_clients_connected
  ON optsislog.network_clients (connected, last_seen_at DESC);
