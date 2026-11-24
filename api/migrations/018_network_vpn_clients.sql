-- Migration 018: clientes de VPN (OpenVPN / Teleport do UCG).
--   Eles NAO aparecem em stat/sta nem na Integration API (nao tem MAC): o UCG os lista
--   em GET /api/s/default/stat/remoteuservpn. Uma linha por usuario+tipo de VPN; quem
--   some da lista e marcado desconectado. Linhas sem atividade ha 30 dias sao apagadas
--   pelo poller.
CREATE TABLE IF NOT EXISTS optsislog.network_vpn_clients (
  client_key TEXT PRIMARY KEY,          -- "<vpn_type>:<usuario>", ex.: "openvpn-server:charles.farias"
  username TEXT NOT NULL,
  vpn_type TEXT,                        -- "openvpn-server"...
  interface TEXT,                       -- "tun1"
  tunnel_ip TEXT,                       -- IP dentro da VPN (10.10.10.x)
  remote_ip TEXT,                       -- IP publico de onde a pessoa conectou
  rx_bytes BIGINT,
  tx_bytes BIGINT,
  connected BOOLEAN NOT NULL DEFAULT true,
  connected_since TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL
);
