-- Migration 021: perda de pacotes (e latencia min/max) das WANs, para o grafico Internet.
--   Fonte: GET v2 aggregated-dashboard?historySeconds=3600 -> wan_activity.
--   activity_by_network_group.<WAN>.history[] (um ponto a cada 5 min, `timestamp` em ms).
--   E' o endpoint da tela do UniFi (pesado no UCG): o poller chama a cada 15 min e grava
--   a ultima hora; pontos repetidos sao atualizados (o ultimo ainda pode estar parcial).
CREATE TABLE IF NOT EXISTS optsislog.network_wan_quality (
  wan_group TEXT NOT NULL,
  sampled_at TIMESTAMPTZ NOT NULL,     -- inicio do intervalo de 5 min (do UniFi)
  packet_loss_pct REAL,
  latency_avg_ms REAL,
  latency_min_ms REAL,
  latency_max_ms REAL,
  PRIMARY KEY (wan_group, sampled_at)
);

CREATE INDEX IF NOT EXISTS idx_network_wan_quality_sampled_at
  ON optsislog.network_wan_quality (sampled_at);
